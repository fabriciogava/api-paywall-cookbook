//! # The Messenger
//!
//! Between our Oracle and the blockchain lies a labyrinth of complexity:
//! transaction signing, RPC endpoints, network fees, confirmation waits.
//! Rather than navigate this maze ourselves, we delegate to a **facilitator**—
//! a trusted intermediary that speaks the blockchain's native tongue.
//!
//! ## The Facilitator's Role
//!
//! The facilitator provides three essential services:
//!
//! 1. **`/supported`** - Tells us what payment methods it can process
//! 2. **`/verify`** - Validates a payment without executing it
//! 3. **`/settle`** - Executes the payment on the blockchain
//!
//! By delegating blockchain operations, our API remains simple and focused.
//! We deal in JSON and HTTP; the facilitator deals in transactions and blocks.
//!
//! ## The Verify-Then-Settle Pattern
//!
//! Why two steps? Consider the alternative: if we settled first and then
//! discovered we couldn't serve the request, we'd have taken money for nothing.
//!
//! Instead:
//! 1. Client sends payment authorization
//! 2. We **verify** it's valid (has funds, proper signature, correct amount)
//! 3. We serve the response
//! 4. Only after success do we **settle** (execute the transfer)
//!
//! If step 3 fails, we never execute step 4. The user keeps their funds.

use reqwest::Client;
use std::time::Duration;

use super::types::{
    FacilitatorRequest, PaymentPayload, PaymentRequirements, SettlementResponse,
    SupportedResponse, VerifyResponse,
};

// =============================================================================
// The Facilitator Client
// =============================================================================

/// HTTP client for communicating with the x402 facilitator.
///
/// This client handles all HTTP communication with the facilitator service.
/// It's designed to be cloned cheaply (the inner HTTP client is reference-counted)
/// and used from multiple async tasks.
///
/// # Example
///
/// ```rust,ignore
/// let client = FacilitatorClient::new("https://gateway.kobaru.io");
///
/// // Check if our configuration is supported
/// if client.is_supported("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", "exact").await? {
///     println!("Configuration valid!");
/// }
/// ```
#[derive(Debug, Clone)]
pub struct FacilitatorClient {
    /// The facilitator's base URL, without trailing slash.
    base_url: String,
    /// The underlying HTTP client. Reqwest clients are designed to be reused
    /// and handle connection pooling internally.
    client: Client,
    /// Optional API key for Kobaru premium features.
    /// When set, included as Authorization: Bearer header in requests.
    api_key: Option<String>,
}

impl FacilitatorClient {
    /// Create a new facilitator client.
    ///
    /// The client is configured with a 30-second timeout, which should be
    /// sufficient for most operations. The facilitator typically responds
    /// in under a second, but blockchain operations can occasionally be slow.
    ///
    /// # Arguments
    ///
    /// * `base_url` - The facilitator's base URL (e.g., "https://gateway.kobaru.io")
    ///
    /// # Panics
    ///
    /// Panics if the HTTP client cannot be created. This should never happen
    /// in practice, but if it does, there's no way to recover.
    pub fn new(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            // Remove trailing slash to avoid double-slashes in URLs
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
            api_key: None,
        }
    }

    /// Create a new facilitator client with an API key.
    ///
    /// The API key enables Kobaru premium features like:
    /// - The Crimson Hexagon merchant console
    /// - Usage analytics and revenue tracking
    /// - Priority support
    ///
    /// # Arguments
    ///
    /// * `base_url` - The facilitator's base URL
    /// * `api_key` - Your Kobaru API key
    pub fn with_api_key(base_url: &str, api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
            api_key: Some(api_key),
        }
    }

    /// Add authorization header if API key is configured.
    fn add_auth_header(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) => request.header("Authorization", format!("Bearer {}", key)),
            None => request,
        }
    }

    // =========================================================================
    // /supported - Discover Facilitator Capabilities
    // =========================================================================

    /// Fetch the facilitator's supported payment configurations.
    ///
    /// Call this on startup to verify the facilitator supports your configured
    /// network and scheme. There's no point accepting payment requests if the
    /// facilitator can't process them.
    ///
    /// # Returns
    ///
    /// A `SupportedResponse` containing:
    /// - `kinds`: All supported scheme/network combinations
    /// - `signers`: Fee payer addresses for each network
    /// - `extensions`: Any protocol extensions the facilitator supports
    ///
    /// # Errors
    ///
    /// - `NetworkError`: Connection failed, timeout, DNS resolution failed, etc.
    /// - `ApiError`: The facilitator returned an error response
    /// - `ParseError`: The response wasn't valid JSON
    pub async fn fetch_supported(&self) -> Result<SupportedResponse, FacilitatorError> {
        let url = format!("{}/supported", self.base_url);

        log::debug!("Fetching supported configurations from: {}", url);

        // Send the GET request (with API key if configured)
        let request = self.client.get(&url);
        let response = self
            .add_auth_header(request)
            .send()
            .await
            .map_err(|e| FacilitatorError::NetworkError(e.to_string()))?;

        // Check for HTTP errors (4xx, 5xx)
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "No body".to_string());
            return Err(FacilitatorError::ApiError { status, body });
        }

        // Parse the JSON response
        response
            .json::<SupportedResponse>()
            .await
            .map_err(|e| FacilitatorError::ParseError(e.to_string()))
    }

    // =========================================================================
    // /verify - Validate Payment Without Executing
    // =========================================================================

    /// Verify a payment authorization without settling it.
    ///
    /// This is the first half of the verify-then-settle pattern. We send the
    /// client's payment payload along with our requirements. The facilitator
    /// checks that:
    ///
    /// - The signature is valid
    /// - The transaction transfers the correct amount
    /// - The payer has sufficient funds
    /// - The payment hasn't expired
    ///
    /// If verification fails, we return 402 to the client and never serve
    /// the protected resource.
    ///
    /// # Arguments
    ///
    /// * `payload` - The payment payload from the client's X-PAYMENT header
    /// * `requirements` - Our payment requirements (amount, token, recipient)
    ///
    /// # Returns
    ///
    /// A `VerifyResponse` with:
    /// - `is_valid`: Whether the payment can be settled
    /// - `invalid_reason`: If invalid, why (e.g., "insufficient_funds")
    /// - `payer`: The payer's wallet address
    pub async fn verify_payment(
        &self,
        payload: &PaymentPayload,
        requirements: &PaymentRequirements,
    ) -> Result<VerifyResponse, FacilitatorError> {
        let url = format!("{}/verify", self.base_url);

        // Bundle the payload and requirements together
        let request = FacilitatorRequest {
            payment_payload: payload.clone(),
            payment_requirements: requirements.clone(),
        };

        log::info!("Verifying payment at: {}", url);
        log::info!(
            "Request body: {}",
            serde_json::to_string_pretty(&request).unwrap_or_default()
        );

        // Send the POST request (with API key if configured)
        let request = self.client.post(&url).json(&request);
        let response = self
            .add_auth_header(request)
            .send()
            .await
            .map_err(|e| FacilitatorError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "No body".to_string());
            log::error!("Verify failed: {} - {}", status, body);
            return Err(FacilitatorError::ApiError { status, body });
        }

        let verify_response = response
            .json::<VerifyResponse>()
            .await
            .map_err(|e| FacilitatorError::ParseError(e.to_string()))?;

        log::info!("Verify response: {:?}", verify_response);

        Ok(verify_response)
    }

    // =========================================================================
    // /settle - Execute the Payment
    // =========================================================================

    /// Settle a verified payment on the blockchain.
    ///
    /// This is the second half of the verify-then-settle pattern. Call this
    /// only AFTER successfully serving the protected resource. The facilitator
    /// will submit the transaction to the blockchain and return the transaction
    /// hash once confirmed.
    ///
    /// # Important
    ///
    /// Settlement should be done asynchronously (fire-and-forget) after sending
    /// the response to the client. This prevents settlement delays from affecting
    /// API latency. If settlement fails, log the error for manual review.
    ///
    /// # Arguments
    ///
    /// * `payload` - The same payment payload used in verification
    /// * `requirements` - The same requirements used in verification
    ///
    /// # Returns
    ///
    /// A `SettlementResponse` with:
    /// - `success`: Whether the transaction was confirmed
    /// - `transaction`: The blockchain transaction hash/signature
    /// - `network`: The network where it was settled
    pub async fn settle_payment(
        &self,
        payload: &PaymentPayload,
        requirements: &PaymentRequirements,
    ) -> Result<SettlementResponse, FacilitatorError> {
        let url = format!("{}/settle", self.base_url);

        let request = FacilitatorRequest {
            payment_payload: payload.clone(),
            payment_requirements: requirements.clone(),
        };

        log::debug!("Settling payment at: {}", url);

        // Send the POST request (with API key if configured)
        let request_builder = self.client.post(&url).json(&request);
        let response = self
            .add_auth_header(request_builder)
            .send()
            .await
            .map_err(|e| FacilitatorError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "No body".to_string());
            log::error!("Settle failed: {} - {}", status, body);
            return Err(FacilitatorError::ApiError { status, body });
        }

        let settle_response = response
            .json::<SettlementResponse>()
            .await
            .map_err(|e| FacilitatorError::ParseError(e.to_string()))?;

        // Log successful settlement for auditing
        log::info!(
            "Payment settled: tx={} payer={:?}",
            settle_response.transaction,
            settle_response.payer
        );

        Ok(settle_response)
    }

    // =========================================================================
    // Convenience Methods
    // =========================================================================

    /// Check if the facilitator supports a specific network and scheme.
    ///
    /// This is a convenience wrapper around `fetch_supported()` that answers
    /// the specific question: "Can we accept payments on this network?"
    ///
    /// # Arguments
    ///
    /// * `network` - The CAIP-2 network ID (e.g., "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
    /// * `scheme` - The payment scheme (typically "exact")
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// if !client.is_supported(&config.network_id, "exact").await? {
    ///     return Err("Facilitator doesn't support our network!");
    /// }
    /// ```
    pub async fn is_supported(
        &self,
        network: &str,
        scheme: &str,
    ) -> Result<bool, FacilitatorError> {
        let supported = self.fetch_supported().await?;

        // Check if any supported kind matches our requirements
        let is_supported = supported
            .kinds
            .iter()
            .any(|k| k.network == network && k.scheme == scheme);

        Ok(is_supported)
    }

    /// Get the fee payer address for a given network.
    ///
    /// The fee payer is the facilitator's wallet that pays blockchain
    /// transaction fees on behalf of users. This is useful for logging
    /// and debugging.
    ///
    /// # Arguments
    ///
    /// * `network` - The network ID to look up
    ///
    /// # Returns
    ///
    /// The fee payer address if one is configured, or None.
    pub async fn get_fee_payer(&self, network: &str) -> Result<Option<String>, FacilitatorError> {
        let supported = self.fetch_supported().await?;

        // Try exact match first (e.g., "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
        if let Some(signers) = supported.signers.get(network) {
            return Ok(signers.first().cloned());
        }

        // Try wildcard pattern (e.g., "solana:*" matches any Solana network)
        let network_prefix = network.split(':').next().unwrap_or(network);
        let wildcard = format!("{}:*", network_prefix);

        if let Some(signers) = supported.signers.get(&wildcard) {
            return Ok(signers.first().cloned());
        }

        Ok(None)
    }
}

// =============================================================================
// Error Types
// =============================================================================
//
// Network operations are inherently fallible. These error types provide
// structured information about what went wrong, enabling appropriate handling.

/// Errors that can occur when communicating with the facilitator.
///
/// Each variant represents a different failure mode:
/// - `NetworkError`: The request never reached the server (or timed out)
/// - `ApiError`: The server responded with an error
/// - `ParseError`: The response wasn't in the expected format
#[derive(Debug, thiserror::Error)]
pub enum FacilitatorError {
    /// Network-level failure: connection refused, timeout, DNS error, etc.
    #[error("Network error: {0}")]
    NetworkError(String),

    /// The facilitator returned an HTTP error response.
    /// Contains the status code and response body for debugging.
    #[error("API error (HTTP {status}): {body}")]
    ApiError { status: u16, body: String },

    /// The response couldn't be parsed as expected JSON.
    /// This usually indicates a version mismatch or facilitator bug.
    #[error("Parse error: {0}")]
    ParseError(String),
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that trailing slashes are removed from the base URL.
    /// This prevents URLs like "https://example.com//verify".
    #[test]
    fn test_client_url_normalization() {
        let client1 = FacilitatorClient::new("https://example.com/");
        let client2 = FacilitatorClient::new("https://example.com");

        assert_eq!(client1.base_url, client2.base_url);
        assert!(!client1.base_url.ends_with('/'));
    }

    /// Verify error display messages are informative.
    #[test]
    fn test_facilitator_error_display() {
        let network_error = FacilitatorError::NetworkError("connection timeout".to_string());
        assert!(network_error.to_string().contains("timeout"));
        assert!(network_error.to_string().contains("Network"));

        let api_error = FacilitatorError::ApiError {
            status: 400,
            body: "invalid request".to_string(),
        };
        assert!(api_error.to_string().contains("400"));
        assert!(api_error.to_string().contains("invalid request"));
    }
}

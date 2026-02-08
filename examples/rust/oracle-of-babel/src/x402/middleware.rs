//! # The Gatekeeper
//!
//! At every entrance to the protected galleries stands a silent guardian.
//! It examines each visitor, checking for the proper credentials—a signed
//! payment authorization in the X-PAYMENT header. Those who present valid
//! payment may pass; those who do not receive a polite but firm HTTP 402.
//!
//! ## What is Middleware?
//!
//! In web frameworks, **middleware** is code that runs around your route
//! handlers. It can:
//! - Inspect incoming requests (like checking for authentication)
//! - Modify requests before handlers see them
//! - Intercept responses and modify them
//! - Short-circuit the request entirely (like returning 402 without calling the handler)
//!
//! Our payment middleware wraps protected routes, intercepting requests to
//! verify payment before allowing access to the actual handlers.
//!
//! ## The Payment Flow
//!
//! ```text
//! Request arrives
//!     │
//!     ▼
//! Is this a protected path?
//!     │
//!     ├─ No  ──────────────────────────────────► Pass through to handler
//!     │
//!     ▼ Yes
//! Is x402 enabled?
//!     │
//!     ├─ No  ──────────────────────────────────► Pass through to handler
//!     │
//!     ▼ Yes
//! Does request have X-PAYMENT header?
//!     │
//!     ├─ No  ──────────────────────────────────► Return 402 PaymentRequired
//!     │
//!     ▼ Yes
//! Is the payment valid? (ask facilitator)
//!     │
//!     ├─ No  ──────────────────────────────────► Return 402 with error
//!     │
//!     ▼ Yes
//! Call the actual handler
//!     │
//!     ▼
//! Was the response successful?
//!     │
//!     ├─ No  ──────────────────────────────────► Return error (no settlement)
//!     │
//!     ▼ Yes
//! Settle payment (blocking, awaited)
//!     │
//!     ├─ Failed  ─────────────────────────────────► Return 402 (settlement failed)
//!     │
//!     ▼ Success
//! Add PAYMENT-RESPONSE header and return response
//! ```
//!
//! ## Actix-Web Middleware Architecture
//!
//! Actix uses a Transform/Service pattern for middleware:
//!
//! - **`X402Middleware`** implements `Transform`. It's the factory that creates
//!   the actual middleware service for each worker thread.
//!
//! - **`X402MiddlewareService`** implements `Service`. It's the actual middleware
//!   that processes requests. Each worker thread gets its own instance.
//!
//! This pattern allows the middleware to be stateless (the factory) while the
//! service instances can hold per-worker state if needed.

use actix_web::{
    body::{BoxBody, EitherBody},
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::{header, StatusCode},
    Error, HttpMessage, HttpRequest, HttpResponse,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use futures_util::future::{ok, LocalBoxFuture, Ready};
use std::{collections::HashMap, rc::Rc, sync::Arc};

use super::{
    config::X402Config,
    http::{FacilitatorClient, FacilitatorError},
    types::{PaymentPayload, PaymentRequired, PaymentRequirements, ResourceInfo, X402_VERSION},
};

// The x402 v2 protocol defines three HTTP headers for the payment lifecycle:
//
//   PAYMENT-REQUIRED   (server → client)  Sent with HTTP 402 to tell the client
//                                          what payment options are accepted.
//
//   PAYMENT-SIGNATURE  (client → server)  Sent by the client with a signed
//                                          payment authorization.
//
//   PAYMENT-RESPONSE   (server → client)  Sent with the successful response to
//                                          give the client the on-chain tx hash
//                                          so they can verify settlement.
//
// All three are base64-encoded JSON. See the x402 v2 spec for the full schemas.

/// The HTTP header name where clients send their payment authorization (v2).
pub const PAYMENT_SIGNATURE_HEADER: &str = "Payment-Signature";

/// The HTTP header where we return payment requirements (on 402 responses).
pub const PAYMENT_REQUIRED_HEADER: &str = "Payment-Required";

/// The HTTP header where we return settlement results (on successful responses).
/// Contains base64-encoded JSON with: `success`, `transaction`, `network`, `payer`.
pub const PAYMENT_RESPONSE_HEADER: &str = "Payment-Response";

// =============================================================================
// X402State - Shared Configuration
// =============================================================================

/// Shared state for the x402 middleware.
///
/// This struct holds everything the middleware needs to process payments:
/// - The configuration (wallet address, prices, etc.)
/// - The facilitator client (for verify/settle calls)
/// - Whether x402 is enabled at all
///
/// It's wrapped in `Arc` for cheap cloning across async boundaries.
#[derive(Debug, Clone)]
pub struct X402State {
    /// The payment configuration.
    pub config: X402Config,

    /// HTTP client for the facilitator. Wrapped in Arc because
    /// FacilitatorClient contains a reqwest::Client which is
    /// designed to be shared.
    pub facilitator: Arc<FacilitatorClient>,

    /// Optional cached fee payer address (for display purposes).
    pub fee_payer: Option<String>,

    /// Master switch for x402. When false, all requests pass through
    /// without payment checks. This enables graceful degradation when
    /// the wallet address isn't configured.
    pub enabled: bool,
}

impl X402State {
    /// Create an enabled X402State from configuration.
    ///
    /// Use this when you have a valid configuration and want to
    /// require payments for protected routes.
    ///
    /// If the config contains a Kobaru API key, it will be included
    /// in all requests to the facilitator for premium feature access.
    pub fn new(config: X402Config) -> Self {
        // Create facilitator client, with API key if configured
        let facilitator = match &config.kobaru_api_key {
            Some(key) => Arc::new(FacilitatorClient::with_api_key(
                &config.facilitator_url,
                key.clone(),
            )),
            None => Arc::new(FacilitatorClient::new(&config.facilitator_url)),
        };

        Self {
            config,
            facilitator,
            fee_payer: None,
            enabled: true,
        }
    }

    /// Create a disabled X402State.
    ///
    /// Use this when payment configuration is missing. The middleware
    /// will pass all requests through without payment checks.
    /// This allows the API to run in "free mode" during development.
    pub fn disabled() -> Self {
        Self {
            config: X402Config {
                wallet_address: "disabled".to_string(),
                facilitator_url: "https://disabled.example.com".to_string(),
                amount: "0".to_string(),
                network_id: "disabled".to_string(),
                asset_address: "disabled".to_string(),
                max_timeout_seconds: 0,
                resource_description: "disabled".to_string(),
                kobaru_api_key: None,
            },
            facilitator: Arc::new(FacilitatorClient::new("https://disabled.example.com")),
            fee_payer: None,
            enabled: false,
        }
    }

    /// Set the fee payer address (builder pattern).
    pub fn with_fee_payer(mut self, fee_payer: String) -> Self {
        self.fee_payer = Some(fee_payer);
        self
    }

    /// Build the PaymentRequirements for a 402 response.
    ///
    /// This describes how the client can pay: the scheme (exact),
    /// the network (Solana), the amount, and where to send it.
    pub fn build_requirements(&self) -> PaymentRequirements {
        let mut extra = HashMap::new();
        // Include token name for human readability
        extra.insert("name".to_string(), serde_json::json!("USDC"));
        extra.insert("version".to_string(), serde_json::json!("2"));

        if let Some(fee_payer) = &self.fee_payer {
            extra.insert("feePayer".to_string(), serde_json::json!(fee_payer));
        }

        PaymentRequirements {
            scheme: "exact".to_string(),
            network: self.config.network_id.clone(),
            amount: self.config.amount.clone(),
            asset: self.config.asset_address.clone(),
            pay_to: self.config.wallet_address.clone(),
            max_timeout_seconds: self.config.max_timeout_seconds,
            extra: Some(extra),
        }
    }

    /// Build the complete PaymentRequired response body.
    ///
    /// This is the JSON body that accompanies an HTTP 402 response.
    /// It tells the client everything they need to construct a payment.
    pub fn build_payment_required(&self, resource_url: &str) -> PaymentRequired {
        PaymentRequired {
            x402_version: X402_VERSION,
            error: Some(format!("{} header is required", PAYMENT_SIGNATURE_HEADER)),
            resource: ResourceInfo {
                url: resource_url.to_string(),
                description: Some(self.config.resource_description.clone()),
                mime_type: Some("application/json".to_string()),
            },
            accepts: vec![self.build_requirements()],
            extensions: HashMap::new(),
        }
    }
}

// =============================================================================
// X402Middleware - The Factory
// =============================================================================

/// Middleware factory for x402 payment protection.
///
/// This struct implements `Transform`, which is Actix's way of defining
/// middleware. When you call `.wrap(X402Middleware::new(...))`, Actix
/// calls `new_transform` for each worker thread to create the actual
/// middleware service.
pub struct X402Middleware {
    /// Shared state (configuration, facilitator client).
    state: Arc<X402State>,

    /// Which paths require payment. If empty, ALL paths are protected.
    /// Paths are matched exactly (no wildcards or patterns).
    protected_paths: Vec<String>,
}

impl X402Middleware {
    /// Create middleware that protects ALL paths.
    ///
    /// Every request will require payment (unless x402 is disabled).
    /// Use this for APIs where every endpoint should be paywalled.
    pub fn new(state: X402State) -> Self {
        Self {
            state: Arc::new(state),
            protected_paths: vec![],
        }
    }

    /// Create middleware that only protects specific paths.
    ///
    /// Only the listed paths require payment; all other paths are free.
    /// Use this for APIs with a mix of free and paid endpoints.
    ///
    /// # Example
    ///
    /// ```rust,ignore
    /// // Only /search requires payment; /, /health, /page are free
    /// .wrap(X402Middleware::protect_paths(state, vec!["/search"]))
    /// ```
    pub fn protect_paths(state: X402State, paths: Vec<&str>) -> Self {
        Self {
            state: Arc::new(state),
            protected_paths: paths.into_iter().map(String::from).collect(),
        }
    }
}

// Implement Transform to make this a valid Actix middleware factory.
// The generic parameters are complex because Actix is extremely flexible:
// - S: The wrapped service type
// - B: The response body type
impl<S, B> Transform<S, ServiceRequest> for X402Middleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    // The response type is EitherBody because we might return the inner
    // service's response (Left) or our own 402 response (Right).
    type Response = ServiceResponse<EitherBody<B, BoxBody>>;
    type Error = Error;
    type Transform = X402MiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    /// Create the middleware service for a worker thread.
    fn new_transform(&self, service: S) -> Self::Future {
        ok(X402MiddlewareService {
            service: Rc::new(service),
            state: self.state.clone(),
            protected_paths: self.protected_paths.clone(),
        })
    }
}

// =============================================================================
// X402MiddlewareService - The Actual Middleware
// =============================================================================

/// The middleware service that processes each request.
///
/// This is created by `X402Middleware::new_transform` and handles
/// the actual payment verification logic.
pub struct X402MiddlewareService<S> {
    /// The wrapped service (the next middleware or route handler).
    service: Rc<S>,

    /// Shared payment state.
    state: Arc<X402State>,

    /// Which paths require payment.
    protected_paths: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for X402MiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B, BoxBody>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    // forward_ready! delegates the ready check to the wrapped service.
    // This is part of the Service trait's backpressure mechanism.
    forward_ready!(service);

    /// Process an incoming request.
    ///
    /// This is the heart of the middleware. It implements the payment
    /// flow described in the module documentation.
    fn call(&self, req: ServiceRequest) -> Self::Future {
        // Clone what we need for the async block.
        // These clones are cheap: Rc and Arc just increment reference counts.
        let service = self.service.clone();
        let state = self.state.clone();
        let protected_paths = self.protected_paths.clone();

        // Return a pinned, boxed future. This is required because the
        // future's type is complex and needs to be type-erased.
        Box::pin(async move {
            // ─────────────────────────────────────────────────────────────
            // Step 1: Check if this path is protected
            // ─────────────────────────────────────────────────────────────

            let path = req.path();
            let method = req.method();
            log::info!("x402 middleware processing: {} {}", method, path);
            
            // Allow OPTIONS requests (CORS preflight) always
            if method == actix_web::http::Method::OPTIONS {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            let is_protected = if protected_paths.is_empty() {
                // No paths specified = protect everything
                true
            } else {
                // Check if current path is in the protected list
                protected_paths.iter().any(|p| p == path)
            };

            // Unprotected paths pass through without payment
            if !is_protected {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // ─────────────────────────────────────────────────────────────
            // Step 2: Check if x402 is enabled
            // ─────────────────────────────────────────────────────────────

            // When disabled, all requests pass through. This enables
            // running the API without payment during development.
            if !state.enabled {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // ─────────────────────────────────────────────────────────────
            // Step 3: Build the resource URL for error responses
            // ─────────────────────────────────────────────────────────────

            let resource_url = format!(
                "{}://{}{}",
                req.connection_info().scheme(),
                req.connection_info().host(),
                req.path()
            );

            // ─────────────────────────────────────────────────────────────
            // Step 4: Check for Payment-Signature header (x402 v2)
            // ─────────────────────────────────────────────────────────────

            // We look for "Payment-Signature" (case-insensitive)
            let payment_token = req.headers()
                .get(PAYMENT_SIGNATURE_HEADER)
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string());

            match payment_token {
                None => {
                    // No valid header found
                    log::info!("No {} header found. Returning 402.", PAYMENT_SIGNATURE_HEADER);

                    // Debug: Log complete headers to see what IS there
                    if log::log_enabled!(log::Level::Debug) {
                         log::debug!("Available headers:");
                         for (name, val) in req.headers() {
                             log::debug!(" - {}: {:?}", name, val);
                         }
                    }

                    let payment_required = state.build_payment_required(&resource_url);
                    
                    // Serialize to JSON
                    let json_bytes = serde_json::to_vec(&payment_required)
                        .unwrap_or_else(|_| b"{}".to_vec());
                        
                    // Base64 encode for the header
                    let header_value = BASE64.encode(json_bytes);

                    let response = HttpResponse::build(StatusCode::PAYMENT_REQUIRED)
                        .insert_header((header::CONTENT_TYPE, "application/json"))
                        // Use Payment-Required header (v2 standard)
                        .insert_header((PAYMENT_REQUIRED_HEADER, header_value))
                        .insert_header(("Access-Control-Expose-Headers", PAYMENT_REQUIRED_HEADER))
                        .body("{}");

                    // map_into_right_body because this is OUR response, not the inner service's
                    Ok(req
                        .into_response(response)
                        .map_into_boxed_body()
                        .map_into_right_body())
                }
                Some(token) => {
                    // ─────────────────────────────────────────────────────
                    // Step 5: Decode and verify the payment
                    // ─────────────────────────────────────────────────────

                    log::info!("Received {} header ({} chars)", PAYMENT_SIGNATURE_HEADER, token.len());

                    match decode_and_verify_payment(&token, &state).await {
                        Ok(payment_payload) => {
                            // Payment verified! Log it.
                            log::info!(
                                "Payment verified for {} from {:?}",
                                resource_url,
                                payment_payload
                                    .accepted
                                    .pay_to
                                    .chars()
                                    .take(8)
                                    .collect::<String>()
                            );

                            // Store payment data for potential later use
                            let payment_data = PaymentData {
                                payload: payment_payload,
                                requirements: state.build_requirements(),
                            };
                            req.extensions_mut().insert(payment_data.clone());

                            // ─────────────────────────────────────────────
                            // Step 6: Call the actual handler
                            // ─────────────────────────────────────────────

                            let res = service.call(req).await?;

                            // ─────────────────────────────────────────────
                            // Step 7: Settle if successful
                            // ─────────────────────────────────────────────
                            //
                            // IMPORTANT: Settlement MUST be blocking (awaited),
                            // not fire-and-forget. This matches the official
                            // TypeScript SDK behavior. The three outcomes are:
                            //
                            //   1. Handler failed (non-2xx) → skip settlement
                            //      entirely. The user keeps their funds.
                            //
                            //   2. Settlement succeeds → attach PAYMENT-RESPONSE
                            //      header with the tx hash, return the handler's
                            //      original response to the client.
                            //
                            //   3. Settlement fails → discard the handler's
                            //      response and return 402 instead. The client
                            //      must NOT receive content they didn't pay for.

                            if !res.status().is_success() {
                                return Ok(res.map_into_left_body());
                            }

                            match state
                                .facilitator
                                .settle_payment(
                                    &payment_data.payload,
                                    &payment_data.requirements,
                                )
                                .await
                            {
                                Ok(settle_response) if settle_response.success => {
                                    // Settlement succeeded—add PAYMENT-RESPONSE
                                    // header so the client can verify the tx.
                                    let settle_json = serde_json::to_vec(&settle_response)
                                        .unwrap_or_else(|_| b"{}".to_vec());
                                    let encoded = BASE64.encode(&settle_json);

                                    let mut res = res;
                                    if let Ok(val) = header::HeaderValue::from_str(&encoded) {
                                        res.response_mut().headers_mut().insert(
                                            header::HeaderName::from_static("payment-response"),
                                            val,
                                        );
                                        res.response_mut().headers_mut().insert(
                                            header::HeaderName::from_static(
                                                "access-control-expose-headers",
                                            ),
                                            header::HeaderValue::from_static(
                                                "Payment-Required, Payment-Response",
                                            ),
                                        );
                                    }

                                    log::info!(
                                        "Settlement successful: tx={}",
                                        settle_response.transaction
                                    );

                                    Ok(res.map_into_left_body())
                                }
                                Ok(settle_response) => {
                                    // Settlement returned success: false.
                                    // We MUST discard the handler's response and
                                    // return 402 instead—otherwise the client gets
                                    // content for free. We extract the HttpRequest
                                    // from the ServiceResponse via into_parts() so
                                    // we can build a fresh error response.
                                    let reason = settle_response
                                        .error_reason
                                        .unwrap_or_else(|| "Unknown reason".to_string());
                                    log::error!("Settlement failed: {}", reason);

                                    let (http_req, _) = res.into_parts();
                                    let response =
                                        HttpResponse::build(StatusCode::PAYMENT_REQUIRED)
                                            .insert_header((
                                                header::CONTENT_TYPE,
                                                "application/json",
                                            ))
                                            .json(serde_json::json!({
                                                "error": "Settlement failed",
                                                "details": reason
                                            }));

                                    Ok(ServiceResponse::new(http_req, response)
                                        .map_into_boxed_body()
                                        .map_into_right_body())
                                }
                                Err(e) => {
                                    // Facilitator communication error—treat as
                                    // settlement failure.
                                    log::error!("Settlement error: {}", e);

                                    let (http_req, _) = res.into_parts();
                                    let response =
                                        HttpResponse::build(StatusCode::PAYMENT_REQUIRED)
                                            .insert_header((
                                                header::CONTENT_TYPE,
                                                "application/json",
                                            ))
                                            .json(serde_json::json!({
                                                "error": "Settlement failed",
                                                "details": e.to_string()
                                            }));

                                    Ok(ServiceResponse::new(http_req, response)
                                        .map_into_boxed_body()
                                        .map_into_right_body())
                                }
                            }
                        }
                        Err(e) => {
                            // Payment verification failed
                            log::warn!("Payment verification failed: {}", e);

                            let response = HttpResponse::build(StatusCode::PAYMENT_REQUIRED)
                                .insert_header((header::CONTENT_TYPE, "application/json"))
                                .json(serde_json::json!({
                                    "error": "Payment verification failed",
                                    "reason": e.to_string()
                                }));

                            Ok(req
                                .into_response(response)
                                .map_into_boxed_body()
                                .map_into_right_body())
                        }
                    }
                }
            }
        })
    }
}

// =============================================================================
// Payment Data
// =============================================================================

/// Payment information stored in request extensions.
///
/// After verifying a payment, we store its details in the request extensions.
/// This allows route handlers to access payment information if needed
/// (e.g., for logging or custom receipt generation).
#[derive(Debug, Clone)]
pub struct PaymentData {
    /// The verified payment payload.
    pub payload: PaymentPayload,
    /// Our payment requirements (for settlement).
    pub requirements: PaymentRequirements,
}

/// Extract payment data from a request.
///
/// Call this from a route handler to get payment details after
/// the middleware has verified the payment.
///
/// # Example
///
/// ```rust,ignore
/// async fn my_handler(req: HttpRequest) -> impl Responder {
///     if let Some(payment) = get_payment_data(&req) {
///         log::info!("Paid by: {:?}", payment.payload.accepted.pay_to);
///     }
///     "OK"
/// }
/// ```
pub fn get_payment_data(req: &HttpRequest) -> Option<PaymentData> {
    req.extensions().get::<PaymentData>().cloned()
}

// =============================================================================
// Payment Decoding and Verification
// =============================================================================

/// Decode the X-PAYMENT header and verify the payment with the facilitator.
///
/// The header contains a base64-encoded JSON PaymentPayload. We:
/// 1. Decode the base64
/// 2. Parse the JSON
/// 3. Send to facilitator for cryptographic verification
/// 4. Check the verification result
async fn decode_and_verify_payment(
    header_value: &str,
    state: &X402State,
) -> Result<PaymentPayload, PaymentError> {
    // Step 1: Decode base64
    // The payment payload is base64-encoded to be header-safe
    let decoded_bytes = BASE64
        .decode(header_value)
        .map_err(|e| PaymentError::DecodeError(format!("Base64 decode failed: {}", e)))?;

    // Step 2: Convert to UTF-8 string
    let payload_str = String::from_utf8(decoded_bytes)
        .map_err(|e| PaymentError::DecodeError(format!("UTF-8 decode failed: {}", e)))?;

    log::info!("Decoded payment payload: {}", payload_str);

    // Step 3: Parse JSON into PaymentPayload struct
    let payment_payload: PaymentPayload = serde_json::from_str(&payload_str)
        .map_err(|e| PaymentError::DecodeError(format!("JSON parse failed: {}", e)))?;

    // Step 4: Verify with facilitator
    // The facilitator checks signatures, balances, and amounts
    let requirements = state.build_requirements();

    let verify_response = state
        .facilitator
        .verify_payment(&payment_payload, &requirements)
        .await
        .map_err(|e| match e {
            FacilitatorError::NetworkError(msg) => PaymentError::VerifyError(msg),
            FacilitatorError::ApiError { status, body } => {
                PaymentError::VerifyError(format!("API error {}: {}", status, body))
            }
            FacilitatorError::ParseError(msg) => PaymentError::VerifyError(msg),
        })?;

    // Step 5: Check verification result
    if !verify_response.is_valid {
        return Err(PaymentError::InvalidPayment(
            verify_response
                .invalid_reason
                .unwrap_or_else(|| "Unknown reason".to_string()),
        ));
    }

    log::info!("Payment verified from payer: {:?}", verify_response.payer);

    Ok(payment_payload)
}

// =============================================================================
// Error Types
// =============================================================================

/// Errors that can occur during payment processing.
#[derive(Debug, thiserror::Error)]
pub enum PaymentError {
    /// Failed to decode the X-PAYMENT header (bad base64, invalid JSON, etc.)
    #[error("Decode error: {0}")]
    DecodeError(String),
    /// Failed to communicate with the facilitator
    #[error("Verify error: {0}")]
    VerifyError(String),
    /// Payment was decoded but is invalid (insufficient funds, wrong amount, etc.)
    #[error("Invalid payment: {0}")]
    InvalidPayment(String),
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a test configuration for unit tests.
    fn test_config() -> X402Config {
        X402Config {
            wallet_address: "TestWallet123".to_string(),
            facilitator_url: "https://test.example.com".to_string(),
            amount: "1000".to_string(),
            network_id: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1".to_string(),
            asset_address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU".to_string(),
            max_timeout_seconds: 60,
            resource_description: "Test resource".to_string(),
            kobaru_api_key: None,
        }
    }

    #[test]
    fn test_build_requirements() {
        let state = X402State::new(test_config());
        let requirements = state.build_requirements();

        assert_eq!(requirements.scheme, "exact");
        assert_eq!(
            requirements.network,
            "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
        );
        assert_eq!(requirements.amount, "1000");
        assert_eq!(requirements.pay_to, "TestWallet123");
    }

    #[test]
    fn test_build_payment_required() {
        let state = X402State::new(test_config());
        let payment_required = state.build_payment_required("https://example.com/search");

        assert_eq!(payment_required.x402_version, 2);
        assert_eq!(payment_required.resource.url, "https://example.com/search");
        assert!(payment_required.error.is_some());
        assert_eq!(payment_required.accepts.len(), 1);
    }

    #[test]
    fn test_payment_required_json_format() {
        let state = X402State::new(test_config());
        let payment_required = state.build_payment_required("https://example.com/api");

        let json = serde_json::to_string(&payment_required).unwrap();

        // Verify x402 v2 spec compliance
        assert!(json.contains("\"x402Version\":2"));
        assert!(json.contains("\"scheme\":\"exact\""));
        assert!(json.contains("\"network\":\"solana:"));
        assert!(json.contains("\"payTo\":"));
        assert!(json.contains("\"maxTimeoutSeconds\":"));
        assert!(json.contains("\"accepts\":["));
    }

    #[test]
    fn test_payment_error_display() {
        let decode_err = PaymentError::DecodeError("test".to_string());
        assert!(decode_err.to_string().contains("Decode error"));

        let verify_err = PaymentError::VerifyError("test".to_string());
        assert!(verify_err.to_string().contains("Verify error"));

        let invalid_err = PaymentError::InvalidPayment("insufficient_funds".to_string());
        assert!(invalid_err.to_string().contains("insufficient_funds"));
    }
}

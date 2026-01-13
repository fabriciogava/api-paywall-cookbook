//! # The Vocabulary of Commerce
//!
//! Before any exchange can occur, both parties must speak the same language.
//! This module defines the precise shapes of data that flow between client,
//! server, and facilitator—the grammar of our payment protocol.
//!
//! ## The x402 Specification
//!
//! These types implement the [x402 v2 specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md).
//! Every field name, every structure, follows the protocol exactly. Deviation
//! would be like misspelling a word in an incantation—the magic would fail.
//!
//! ## Why Serde?
//!
//! We use the `serde` crate for serialization because:
//! 1. It generates JSON that matches the spec's camelCase conventions
//! 2. It handles optional fields gracefully with `Option<T>`
//! 3. It's the de facto standard in the Rust ecosystem
//!
//! The `#[serde(rename_all = "camelCase")]` attribute transforms Rust's
//! `snake_case` field names to the JSON's `camelCase` automatically.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The protocol version we implement. This must be 2 for x402 v2.
/// Including this in every message allows clients and servers to
/// negotiate compatibility and reject incompatible protocol versions.
pub const X402_VERSION: u8 = 2;

// ============================================================================
// PART I: The 402 Response
// ============================================================================
//
// When a client requests a protected resource without payment, we return
// HTTP 402 with a body that tells them exactly how to pay. Think of it as
// a price tag that also includes payment instructions.

/// Information about the resource being protected.
///
/// This tells the client what they're paying for—like the description
/// on a museum's admission ticket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInfo {
    /// The URL of the protected resource (e.g., "https://api.example.com/search")
    pub url: String,

    /// A human-readable description of what the resource provides.
    /// Optional but recommended—it helps users understand the value proposition.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// The MIME type of the response (e.g., "application/json").
    /// Helps clients know what to expect after payment.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

/// A single acceptable payment method.
///
/// The server may accept multiple payment methods (different tokens, networks,
/// or amounts). Each one is described by a `PaymentRequirements` object.
/// The client chooses one and fulfills it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequirements {
    /// The payment scheme identifier. Currently, "exact" is the main scheme,
    /// meaning the client must pay exactly the specified amount.
    pub scheme: String,

    /// The blockchain network in CAIP-2 format.
    /// Examples:
    /// - Solana Devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
    /// - Solana Mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    /// - Base Sepolia: "eip155:84532"
    pub network: String,

    /// The payment amount in the token's smallest unit (atomic units).
    /// For USDC with 6 decimals, "1000000" = 1 USDC.
    /// We use a string to avoid floating-point precision issues.
    pub amount: String,

    /// The token's contract/mint address.
    /// For Solana, this is the SPL token mint address.
    /// For EVM chains, this is the ERC-20 contract address.
    pub asset: String,

    /// The merchant's wallet address that will receive the payment.
    /// This is where the tokens will be transferred when the payment settles.
    pub pay_to: String,

    /// How long the client has to complete the payment, in seconds.
    /// After this timeout, the payment authorization expires.
    pub max_timeout_seconds: u32,

    /// Additional scheme-specific data. For example, the "exact" scheme
    /// may include the token name ("USDC") and version here.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<HashMap<String, serde_json::Value>>,
}

/// The complete 402 Payment Required response body.
///
/// This is the JSON that accompanies an HTTP 402 response. It contains
/// everything a client needs to construct a valid payment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequired {
    /// Protocol version (must be 2).
    pub x402_version: u8,

    /// A human-readable error message explaining why payment is required.
    /// Optional but helpful for debugging.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    /// Information about the protected resource.
    pub resource: ResourceInfo,

    /// Array of acceptable payment methods. The client picks one.
    /// Having multiple options allows flexibility (e.g., pay in USDC or EURC).
    pub accepts: Vec<PaymentRequirements>,

    /// Protocol extensions. Reserved for future use and custom features.
    /// Most implementations can ignore this.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub extensions: HashMap<String, serde_json::Value>,
}

// ============================================================================
// PART II: The Payment Payload
// ============================================================================
//
// After receiving a 402, the client constructs a payment authorization—
// a signed transaction that proves they have the funds and consent to pay.
// They send this in the X-PAYMENT header, base64-encoded.

/// Solana-specific payment data.
///
/// For Solana payments, this contains the serialized, signed transaction.
/// The transaction transfers tokens from the payer to the merchant,
/// but it's not yet submitted to the blockchain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolanaPayload {
    /// The complete signed transaction, base64-encoded.
    /// This transaction is ready to be submitted to the Solana network.
    pub transaction: String,
}

/// The payment authorization sent by the client.
///
/// This is what the client puts in the X-PAYMENT header (base64-encoded JSON).
/// It proves they've authorized the payment but doesn't execute it yet—
/// that happens when the facilitator calls "settle".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentPayload {
    /// Protocol version (must match what the server sent).
    pub x402_version: u8,

    /// Echo of the resource being accessed (for verification).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<ResourceInfo>,

    /// Which payment method the client chose (from the `accepts` array).
    /// This must match one of the options the server provided.
    pub accepted: PaymentRequirements,

    /// The actual payment data (the signed transaction).
    pub payload: SolanaPayload,

    /// Protocol extensions, echoed from the 402 response if any.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub extensions: HashMap<String, serde_json::Value>,
}

// ============================================================================
// PART III: Facilitator Communication
// ============================================================================
//
// The facilitator is the trusted intermediary that talks to the blockchain.
// We send it the payment payload and our requirements; it verifies the
// signature, checks the balance, and (when we ask) settles the payment.

/// Request body for the facilitator's /verify and /settle endpoints.
///
/// We send both the client's payment and our requirements. The facilitator
/// checks that they match and that the payment is valid.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacilitatorRequest {
    /// The payment payload from the client's X-PAYMENT header.
    pub payment_payload: PaymentPayload,

    /// Our payment requirements (so the facilitator can verify they match).
    pub payment_requirements: PaymentRequirements,
}

/// Response from the facilitator's /verify endpoint.
///
/// This tells us whether the payment authorization is valid WITHOUT
/// actually executing it. We verify before serving the response,
/// then settle after the response succeeds.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResponse {
    /// True if the payment is valid and can be settled.
    pub is_valid: bool,

    /// If invalid, explains why (e.g., "insufficient_funds", "expired").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invalid_reason: Option<String>,

    /// The wallet address of the payer (extracted from the transaction).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payer: Option<String>,
}

/// Response from the facilitator's /settle endpoint.
///
/// This is the result of actually executing the payment on the blockchain.
/// The transaction hash can be used to verify the payment on a block explorer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementResponse {
    /// True if the payment was successfully settled on-chain.
    pub success: bool,

    /// If settlement failed, explains why.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_reason: Option<String>,

    /// The payer's wallet address.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payer: Option<String>,

    /// The blockchain transaction hash/signature.
    /// Use this to look up the transaction on a block explorer.
    pub transaction: String,

    /// The network where the transaction was settled.
    pub network: String,
}

// ============================================================================
// PART IV: Facilitator Capabilities
// ============================================================================
//
// Before we start accepting payments, we should check what the facilitator
// supports. This prevents configuration errors from causing runtime failures.

/// A payment scheme/network combination the facilitator supports.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedKind {
    /// Protocol version supported.
    pub x402_version: u8,

    /// Payment scheme (e.g., "exact").
    pub scheme: String,

    /// Network in CAIP-2 format.
    pub network: String,

    /// Additional configuration for this scheme/network.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<HashMap<String, serde_json::Value>>,
}

/// Response from the facilitator's /supported endpoint.
///
/// Call this on startup to verify the facilitator supports your configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedResponse {
    /// All supported scheme/network combinations.
    pub kinds: Vec<SupportedKind>,

    /// Protocol extensions the facilitator implements.
    #[serde(default)]
    pub extensions: Vec<String>,

    /// Map of network patterns to fee payer addresses.
    /// The fee payer is the facilitator's address that pays transaction fees.
    /// Keys may be wildcards like "solana:*" (any Solana network).
    pub signers: HashMap<String, Vec<String>>,
}

// ============================================================================
// PART V: Error Codes
// ============================================================================
//
// When things go wrong, we need a common vocabulary for failures.
// These error codes are defined in the x402 spec.

/// Standard error codes from the x402 specification.
///
/// Using standard codes helps clients handle errors consistently
/// across different x402 implementations.
#[derive(Debug, Clone, PartialEq)]
pub enum X402ErrorCode {
    /// The payer doesn't have enough tokens.
    InsufficientFunds,
    /// The network ID is invalid or unknown.
    InvalidNetwork,
    /// The payment payload is malformed.
    InvalidPayload,
    /// The payment requirements are invalid.
    InvalidPaymentRequirements,
    /// The payment scheme is invalid.
    InvalidScheme,
    /// The facilitator doesn't support this scheme.
    UnsupportedScheme,
    /// Protocol version mismatch.
    InvalidX402Version,
    /// The transaction is in an invalid state (e.g., already executed).
    InvalidTransactionState,
    /// Unexpected error during verification.
    UnexpectedVerifyError,
    /// Unexpected error during settlement.
    UnexpectedSettleError,
}

impl X402ErrorCode {
    /// Convert to the specification's string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            X402ErrorCode::InsufficientFunds => "insufficient_funds",
            X402ErrorCode::InvalidNetwork => "invalid_network",
            X402ErrorCode::InvalidPayload => "invalid_payload",
            X402ErrorCode::InvalidPaymentRequirements => "invalid_payment_requirements",
            X402ErrorCode::InvalidScheme => "invalid_scheme",
            X402ErrorCode::UnsupportedScheme => "unsupported_scheme",
            X402ErrorCode::InvalidX402Version => "invalid_x402_version",
            X402ErrorCode::InvalidTransactionState => "invalid_transaction_state",
            X402ErrorCode::UnexpectedVerifyError => "unexpected_verify_error",
            X402ErrorCode::UnexpectedSettleError => "unexpected_settle_error",
        }
    }
}

impl std::fmt::Display for X402ErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ============================================================================
// Tests
// ============================================================================
//
// These tests verify that our types serialize to JSON that matches the
// x402 specification exactly. If these pass, we're speaking the right language.

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that PaymentRequired serializes with correct field names.
    /// The JSON must use camelCase (payTo, not pay_to) to match the spec.
    #[test]
    fn test_payment_required_serialization() {
        let payment_required = PaymentRequired {
            x402_version: X402_VERSION,
            error: Some("X-PAYMENT header is required".to_string()),
            resource: ResourceInfo {
                url: "https://example.com/api".to_string(),
                description: Some("Test resource".to_string()),
                mime_type: Some("application/json".to_string()),
            },
            accepts: vec![PaymentRequirements {
                scheme: "exact".to_string(),
                network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1".to_string(),
                amount: "1000".to_string(),
                asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU".to_string(),
                pay_to: "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5".to_string(),
                max_timeout_seconds: 60,
                extra: Some({
                    let mut map = HashMap::new();
                    map.insert("name".to_string(), serde_json::json!("USDC"));
                    map.insert("version".to_string(), serde_json::json!("2"));
                    map
                }),
            }],
            extensions: HashMap::new(),
        };

        let json = serde_json::to_string(&payment_required).unwrap();

        // Verify critical fields use camelCase
        assert!(json.contains("\"x402Version\":2"));
        assert!(json.contains("\"scheme\":\"exact\""));
        assert!(json.contains("\"network\":\"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1\""));
        assert!(json.contains("\"payTo\":"));
        assert!(json.contains("\"maxTimeoutSeconds\":60"));
    }

    /// Test that we can decode a payment payload from JSON.
    /// This simulates receiving a client's X-PAYMENT header content.
    #[test]
    fn test_payment_payload_deserialization() {
        let json = r#"{
            "x402Version": 2,
            "resource": {
                "url": "https://example.com/api",
                "description": "Test"
            },
            "accepted": {
                "scheme": "exact",
                "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                "amount": "1000",
                "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                "payTo": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5",
                "maxTimeoutSeconds": 60
            },
            "payload": {
                "transaction": "base64encodedtransaction=="
            }
        }"#;

        let payload: PaymentPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.x402_version, 2);
        assert_eq!(payload.accepted.scheme, "exact");
        assert_eq!(
            payload.accepted.network,
            "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
        );
        assert_eq!(payload.payload.transaction, "base64encodedtransaction==");
    }

    /// Test decoding a successful verify response from the facilitator.
    #[test]
    fn test_verify_response_deserialization() {
        let json = r#"{
            "isValid": true,
            "payer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
        }"#;

        let response: VerifyResponse = serde_json::from_str(json).unwrap();

        assert!(response.is_valid);
        assert!(response.invalid_reason.is_none());
        assert_eq!(
            response.payer,
            Some("CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5".to_string())
        );
    }

    /// Test decoding a settlement response with transaction hash.
    #[test]
    fn test_settlement_response_deserialization() {
        let json = r#"{
            "success": true,
            "payer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5",
            "transaction": "5wHu1q...",
            "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
        }"#;

        let response: SettlementResponse = serde_json::from_str(json).unwrap();

        assert!(response.success);
        assert!(response.error_reason.is_none());
        assert_eq!(response.transaction, "5wHu1q...");
    }

    /// Test decoding the facilitator's supported configurations.
    #[test]
    fn test_supported_response_deserialization() {
        let json = r#"{
            "kinds": [
                {
                    "x402Version": 2,
                    "scheme": "exact",
                    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
                }
            ],
            "extensions": [],
            "signers": {
                "solana:*": ["CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"]
            }
        }"#;

        let response: SupportedResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.kinds.len(), 1);
        assert_eq!(response.kinds[0].scheme, "exact");
        assert!(response.signers.contains_key("solana:*"));
    }

    #[test]
    fn test_error_code_display() {
        assert_eq!(X402ErrorCode::InsufficientFunds.as_str(), "insufficient_funds");
        assert_eq!(X402ErrorCode::InvalidNetwork.as_str(), "invalid_network");
    }
}

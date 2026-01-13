//! # The Merchant's Terms
//!
//! Every exchange requires agreement on terms: what is being sold, at what price,
//! and where payment should flow. This module reads those terms from the environment,
//! providing sensible defaults for the weary traveler while allowing full customization.
//!
//! ## The Configuration Pattern
//!
//! Rather than hardcode values, we read from environment variables. This allows:
//! - Different settings for development vs. production
//! - Secret values (like wallet addresses) to stay out of source control
//! - Easy configuration in container orchestration (Docker, Kubernetes)
//!
//! ## Required vs. Optional
//!
//! Only one value is truly required: the merchant's wallet address. Without knowing
//! where to send payment, the Oracle cannot accept tribute. All other values have
//! reasonable defaults suitable for development on Solana devnet.

use std::env;

// =============================================================================
// Default Values
// =============================================================================
//
// These defaults create a working configuration for Solana devnet.
// For production, you'll want to override SOLANA_NETWORK_ID and USDC_ASSET_ADDRESS
// with their mainnet equivalents.

/// The default facilitator URL. Kobaru's gateway handles payment verification
/// and settlement, abstracting away the complexity of blockchain interactions.
pub const DEFAULT_FACILITATOR_URL: &str = "https://gateway.kobaru.io";

/// The default network: Solana Devnet.
///
/// Network IDs use the CAIP-2 standard (Chain Agnostic Improvement Proposal).
/// Format: `<namespace>:<reference>`
/// - `solana` = the namespace for Solana chains
/// - `EtWTRABZaYq6iMfeYKouRu166VU2xqa1` = the genesis hash prefix for devnet
pub const DEFAULT_NETWORK_ID: &str = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

/// The default token: USDC on Solana Devnet.
///
/// This is the SPL token mint address. On Solana, tokens are identified by
/// their mint address rather than a symbol. This specific address is the
/// devnet USDC mint managed by Circle.
pub const DEFAULT_USDC_ADDRESS: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// =============================================================================
// Configuration Structure
// =============================================================================

/// Complete x402 payment configuration.
///
/// This struct holds everything needed to accept payments:
/// - Where to receive funds (wallet address)
/// - How much to charge (amount)
/// - What currency to accept (asset address on which network)
/// - How to describe the service (resource description)
#[derive(Debug, Clone)]
pub struct X402Config {
    /// The merchant's Solana wallet address.
    ///
    /// All payments will be sent here. This should be a wallet you control.
    /// On Solana, this is a base58-encoded public key, typically 43-44 characters.
    pub wallet_address: String,

    /// The facilitator's base URL.
    ///
    /// The facilitator is a service that handles payment verification and
    /// settlement on our behalf. We don't need to talk to the blockchain
    /// directly—the facilitator does that for us.
    pub facilitator_url: String,

    /// The payment amount in atomic units.
    ///
    /// USDC has 6 decimal places, so:
    /// - "1000000" = 1.00 USDC
    /// - "1000" = 0.001 USDC
    /// - "100" = 0.0001 USDC
    ///
    /// We use strings to avoid floating-point precision issues.
    pub amount: String,

    /// The blockchain network identifier in CAIP-2 format.
    ///
    /// Examples:
    /// - Solana Devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
    /// - Solana Mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    pub network_id: String,

    /// The token's mint/contract address.
    ///
    /// This identifies which token we accept for payment. Different networks
    /// have different addresses for the same logical token (e.g., USDC on
    /// devnet vs mainnet have different mint addresses).
    pub asset_address: String,

    /// Maximum time allowed for payment completion, in seconds.
    ///
    /// After this timeout, the payment authorization expires and the client
    /// must request a new one. 60 seconds is a reasonable default.
    pub max_timeout_seconds: u32,

    /// Human-readable description of the protected resource.
    ///
    /// This appears in the 402 response and tells clients what they're
    /// paying for. Make it descriptive and enticing.
    pub resource_description: String,

    /// Optional Kobaru API key for premium features.
    ///
    /// When set, this key is included in requests to the facilitator,
    /// enabling access to The Crimson Hexagon—Kobaru's merchant console
    /// for configuration, usage analytics, and revenue tracking.
    /// Sign-up at https://kobaru.io and get your API key at https://console.kobaru.io. 
    ///
    /// Leave unset for basic x402 functionality without premium features.
    pub kobaru_api_key: Option<String>,
}

impl X402Config {
    /// Load configuration from environment variables.
    ///
    /// # Environment Variables
    ///
    /// **Required:**
    /// - `SOLANA_WALLET_ADDRESS`: Your wallet to receive payments
    ///
    /// **Optional (with sensible defaults):**
    /// - `FACILITATOR_URL`: Payment processor URL (default: Kobaru gateway)
    /// - `PAYMENT_AMOUNT`: Price in atomic units (default: "1000" = 0.001 USDC)
    /// - `SOLANA_NETWORK_ID`: Blockchain network (default: Solana devnet)
    /// - `USDC_ASSET_ADDRESS`: Token mint address (default: devnet USDC)
    /// - `PAYMENT_MAX_TIMEOUT`: Timeout in seconds (default: 60)
    /// - `RESOURCE_DESCRIPTION`: Description for 402 response
    /// - `KOBARU_API_KEY`: API key for Kobaru premium features (optional)
    ///
    /// # Errors
    ///
    /// Returns `ConfigError::MissingEnvVar` if SOLANA_WALLET_ADDRESS is not set.
    /// Returns `ConfigError::InvalidValue` if SOLANA_WALLET_ADDRESS is empty.
    ///
    /// # Example
    ///
    /// ```bash
    /// export SOLANA_WALLET_ADDRESS=CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5
    /// export PAYMENT_AMOUNT=5000  # 0.005 USDC per request
    /// cargo run --bin standalone
    /// ```
    pub fn from_env() -> Result<Self, ConfigError> {
        // The wallet address is the one required field—without it, we can't
        // receive payments, so there's no point in starting the payment system.
        let wallet_address = env::var("SOLANA_WALLET_ADDRESS")
            .map_err(|_| ConfigError::MissingEnvVar("SOLANA_WALLET_ADDRESS".to_string()))?;

        // Guard against accidentally setting an empty string
        if wallet_address.is_empty() {
            return Err(ConfigError::InvalidValue(
                "SOLANA_WALLET_ADDRESS cannot be empty".to_string(),
            ));
        }

        // All other values have reasonable defaults for development
        let facilitator_url =
            env::var("FACILITATOR_URL").unwrap_or_else(|_| DEFAULT_FACILITATOR_URL.to_string());

        let amount = env::var("PAYMENT_AMOUNT").unwrap_or_else(|_| "1000".to_string());

        let network_id =
            env::var("SOLANA_NETWORK_ID").unwrap_or_else(|_| DEFAULT_NETWORK_ID.to_string());

        let asset_address =
            env::var("USDC_ASSET_ADDRESS").unwrap_or_else(|_| DEFAULT_USDC_ADDRESS.to_string());

        // Parse timeout as integer, falling back to 60 if parsing fails
        let max_timeout_seconds = env::var("PAYMENT_MAX_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let resource_description = env::var("RESOURCE_DESCRIPTION").unwrap_or_else(|_| {
            "The Oracle reveals the location of any text within the infinite Library of Babel."
                .to_string()
        });

        // Optional Kobaru API key for premium features.
        // When set, enables The Crimson Hexagon console access.
        let kobaru_api_key = env::var("KOBARU_API_KEY").ok().filter(|s| !s.is_empty());

        Ok(Self {
            wallet_address,
            facilitator_url,
            amount,
            network_id,
            asset_address,
            max_timeout_seconds,
            resource_description,
            kobaru_api_key,
        })
    }
}

// =============================================================================
// Error Handling
// =============================================================================
//
// Configuration errors are typically fatal—if we can't configure the payment
// system, we shouldn't start accepting requests. These errors provide clear
// messages about what went wrong.

/// Errors that can occur when loading configuration.
#[derive(Debug)]
pub enum ConfigError {
    /// A required environment variable is not set.
    MissingEnvVar(String),
    /// An environment variable has an invalid value.
    InvalidValue(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::MissingEnvVar(var) => {
                write!(f, "Required environment variable '{}' is not set", var)
            }
            ConfigError::InvalidValue(msg) => write!(f, "Invalid configuration: {}", msg),
        }
    }
}

// Implementing std::error::Error allows this type to work with Rust's
// error handling ecosystem (the ? operator, anyhow, etc.)
impl std::error::Error for ConfigError {}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_values() {
        // Set the one required variable
        env::set_var("SOLANA_WALLET_ADDRESS", "TestWallet123");

        let config = X402Config::from_env().unwrap();

        // Verify defaults are applied correctly
        assert_eq!(config.wallet_address, "TestWallet123");
        assert_eq!(config.facilitator_url, DEFAULT_FACILITATOR_URL);
        assert_eq!(config.network_id, DEFAULT_NETWORK_ID);
        assert_eq!(config.asset_address, DEFAULT_USDC_ADDRESS);
        assert_eq!(config.max_timeout_seconds, 60);

        // Clean up so other tests aren't affected
        env::remove_var("SOLANA_WALLET_ADDRESS");
    }
}

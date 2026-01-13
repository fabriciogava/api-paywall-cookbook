//! # The Oracle Awakens
//!
//! Every library requires a door through which seekers may enter.
//! This is that door—the standalone HTTP server that brings the Oracle
//! to life and listens for those who seek wisdom from the infinite stacks.
//!
//! ## How This Works
//!
//! When you run `cargo run --bin standalone`, this file is compiled and executed.
//! It performs these steps:
//!
//! 1. Loads environment variables from `.env` (if present)
//! 2. Configures logging based on `RUST_LOG`
//! 3. Attempts to load x402 payment configuration
//! 4. If payment config exists, validates it against the facilitator
//! 5. Starts the Actix-web HTTP server
//!
//! ## The Two Modes
//!
//! The Oracle can run in two modes:
//!
//! - **Free Mode**: If `SOLANA_WALLET_ADDRESS` is not set, all requests are free.
//!   This is useful during development and testing.
//!
//! - **Paid Mode**: If `SOLANA_WALLET_ADDRESS` is set, the `/search` endpoint
//!   requires payment. Other endpoints remain free.

use actix_web::{middleware::Logger, web, App, HttpServer};
use log::{error, info, warn};
use std::env;

use oracle_of_babel::x402::{X402Config, X402Middleware, X402State};

/// The main entry point.
///
/// The `#[actix_web::main]` attribute does the heavy lifting of setting up
/// the async runtime (Tokio, in Actix's case) and running our async main
/// function to completion.
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // ─────────────────────────────────────────────────────────────────────
    // Step 1: Load Environment Configuration
    // ─────────────────────────────────────────────────────────────────────

    // dotenvy loads variables from .env file into the environment.
    // The underscore ignores the Result—it's okay if .env doesn't exist.
    let _ = dotenvy::dotenv();

    // Initialize the logger. The level is controlled by RUST_LOG env var.
    // Examples: RUST_LOG=debug, RUST_LOG=oracle_of_babel=debug,actix_web=info
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Server Binding Configuration
    // ─────────────────────────────────────────────────────────────────────

    // These determine where the server listens.
    // 0.0.0.0 means "all network interfaces" (for Docker, etc.)
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let bind_addr = format!("{}:{}", host, port);

    info!("📚 Oracle of Babel starting...");

    // ─────────────────────────────────────────────────────────────────────
    // Step 3: Payment Configuration
    // ─────────────────────────────────────────────────────────────────────

    // Attempt to load x402 configuration. This will fail if
    // SOLANA_WALLET_ADDRESS is not set, which is expected during development.
    let x402_state = match X402Config::from_env() {
        Ok(config) => {
            // Configuration loaded successfully—payments will be enabled.
            info!("💰 x402 payments enabled");
            info!("   Network: {}", config.network_id);
            info!(
                "   Wallet: {}...",
                &config.wallet_address.chars().take(8).collect::<String>()
            );
            info!("   Amount: {} atomic units", config.amount);

            // Log if premium features are enabled via API key
            if config.kobaru_api_key.is_some() {
                info!("   🔑 Kobaru API key configured (Crimson Hexagon enabled)");
            }

            // ─────────────────────────────────────────────────────────────
            // Step 4: Validate Facilitator Support
            // ─────────────────────────────────────────────────────────────

            // Before accepting payment, verify the facilitator can process
            // our configured network. This catches configuration mistakes early.
            let mut state = X402State::new(config.clone());

            match state.facilitator.is_supported(&config.network_id, "exact").await {
                Ok(true) => {
                    info!("✅ Facilitator supports configured network");

                    // Fetch and store the fee payer address
                    if let Ok(Some(fee_payer)) =
                        state.facilitator.get_fee_payer(&config.network_id).await
                    {
                        info!(
                            "   Fee payer: {}...",
                            &fee_payer.chars().take(8).collect::<String>()
                        );
                        state = state.with_fee_payer(fee_payer);
                    }
                }
                Ok(false) => {
                    // The facilitator doesn't support our network!
                    // This is a configuration error—payments will fail.
                    error!(
                        "❌ Facilitator does not support network: {}",
                        config.network_id
                    );
                }
                Err(e) => {
                    // Couldn't reach the facilitator. This might be temporary
                    // (network issue) or permanent (wrong URL). Warn but continue.
                    warn!("⚠️  Could not validate facilitator: {}", e);
                }
            }

            state
        }
        Err(e) => {
            // No wallet address configured—run in free mode.
            // This is the expected path during development.
            warn!("⚠️  x402 payments disabled: {}", e);
            warn!("   Set SOLANA_WALLET_ADDRESS to enable payments");
            X402State::disabled()
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // Step 5: Start the HTTP Server
    // ─────────────────────────────────────────────────────────────────────

    info!("🔮 Listening on http://{}", bind_addr);
    info!("📖 Library: infinite pages, 29 characters each");

    if x402_state.enabled {
        info!("💡 Try: POST /search with {{\"text\": \"hello world\"}} (requires payment)");
    } else {
        info!("💡 Try: POST /search with {{\"text\": \"hello world\"}}");
    }

    // HttpServer::new takes a closure that creates the App for each worker.
    // Actix spawns multiple workers (one per CPU core by default).
    HttpServer::new(move || {
        App::new()
            // Request logging middleware (access logs)
            .wrap(Logger::default())
            // x402 payment middleware - only /search requires payment
            // Other endpoints (/, /health, /page) are free
            .wrap(X402Middleware::protect_paths(
                x402_state.clone(),
                vec!["/search"],
            ))
            // Make x402 state available to handlers (if needed)
            .app_data(web::Data::new(x402_state.clone()))
            // Register all API routes
            .configure(oracle_of_babel::api::configure_routes)
    })
    .bind(&bind_addr)?
    // Give in-flight requests 30 seconds to complete on shutdown
    .shutdown_timeout(30)
    .run()
    .await
}

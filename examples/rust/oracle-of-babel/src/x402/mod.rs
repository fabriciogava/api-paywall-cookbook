//! # The Toll Gate of Infinite Knowledge
//!
//! In the vast corridors of the Library, nothing is truly free. Each page retrieved,
//! each text located, consumes the irreplaceable currency of computation. This module
//! implements the x402 payment protocol—a way for seekers to compensate the Oracle
//! for its services.
//!
//! ## What is x402?
//!
//! The x402 protocol (named after HTTP status code 402 "Payment Required") defines
//! a standard way for APIs to request and verify cryptocurrency payments. When a
//! client requests a protected resource without payment, the server responds with
//! HTTP 402 and a JSON body describing how to pay. The client then includes a
//! signed payment authorization in subsequent requests.
//!
//! ## The Architecture of Exchange
//!
//! This implementation follows a clean separation of concerns:
//!
//! - **`types`**: The vocabulary of commerce—data structures that both parties understand
//! - **`config`**: The merchant's terms—prices, accepted currencies, wallet addresses
//! - **`http`**: The messenger—communicates with the facilitator who settles payments
//! - **`middleware`**: The gatekeeper—intercepts requests and enforces payment requirements
//!
//! ## The Flow of Value
//!
//! ```text
//! Client                    Oracle                    Facilitator
//!   |                         |                           |
//!   |-- GET /search --------->|                           |
//!   |<-- 402 PaymentRequired--|                           |
//!   |                         |                           |
//!   |-- GET /search + X-PAYMENT header ------------------>|
//!   |                         |-- POST /verify ---------->|
//!   |                         |<-- {isValid: true} -------|
//!   |<-- 200 + response ------|                           |
//!   |                         |-- POST /settle ---------->|
//!   |                         |<-- {success: true} -------|
//! ```
//!
//! The facilitator is a trusted intermediary that verifies payment signatures
//! and settles transactions on the blockchain, so our API doesn't need to
//! interact with the chain directly.

pub mod config;
pub mod http;
pub mod middleware;
pub mod types;

// Re-export the essential types for convenient access.
// Users of this module can write `x402::X402Config` instead of `x402::config::X402Config`.
pub use config::X402Config;
pub use http::FacilitatorClient;
pub use middleware::{X402Middleware, X402State};
pub use types::*;

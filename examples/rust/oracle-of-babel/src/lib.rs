//! Oracle of Babel - A Rust implementation of the Library of Babel
//!
//! This crate provides a deterministic, reversible mapping between text
//! and addresses in the infinite Library of Babel.
//!
//! Inspired by the Library of Babel concept. Uses a different permutation
//! algorithm than libraryofbabel.info, creating a parallel universe of addresses.

pub mod api;
pub mod babel;
pub mod x402;

pub use api::create_app;
pub use babel::{BabelAddress, BabelLibrary, BabelError, BabelResult};


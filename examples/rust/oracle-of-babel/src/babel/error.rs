//! Error types for the Library of Babel
//!
//! Provides structured, typed errors for all operations within the Library.

use thiserror::Error;

/// Errors that can occur when interacting with the Library of Babel.
#[derive(Debug, Error)]
pub enum BabelError {
    /// The input text contains a character not in the Library's alphabet.
    ///
    /// The Library only accepts: lowercase letters (a-z), space, comma, and period.
    #[error("Invalid character '{0}'. Only letters (a-z), space, comma, and period are allowed.")]
    InvalidCharacter(char),

    /// The input text exceeds the maximum page length.
    #[error("Text too long: {actual} characters (maximum is {max})")]
    TextTooLong {
        /// The length of the provided text
        actual: usize,
        /// The maximum allowed length (3200 characters)
        max: usize,
    },

    /// An address component is outside its valid range.
    #[error("Invalid {component}: {value} (must be {min}-{max})")]
    InvalidAddressComponent {
        /// The name of the invalid component (wall, shelf, volume, page)
        component: &'static str,
        /// The provided value
        value: u64,
        /// Minimum valid value
        min: u64,
        /// Maximum valid value
        max: u64,
    },

    /// The hexagon identifier is empty.
    #[error("Hexagon identifier cannot be empty")]
    EmptyHexagon,

    /// The hexagon identifier contains invalid characters.
    ///
    /// Hexagons must be encoded in base-36 (0-9, a-z).
    #[error("Invalid hexagon character '{0}'. Must be 0-9 or a-z.")]
    InvalidHexagonCharacter(char),
}

/// A type alias for Results using BabelError.
pub type BabelResult<T> = Result<T, BabelError>;

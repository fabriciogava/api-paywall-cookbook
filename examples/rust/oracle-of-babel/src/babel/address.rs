//! Babel Address structure and conversion
//!
//! Implements the Library of Babel encoding scheme:
//! - Combined value = (location_index * base_29^3200) + text_value
//! - Hexagon = combined_value / LOCATIONS_PER_HEXAGON (in base-36)
//! - Location within hexagon determines wall, shelf, volume, page

use num_bigint::BigUint;
use num_traits::{Zero, ToPrimitive};
use serde::{Deserialize, Serialize};

use super::{WALLS, SHELVES, VOLUMES, PAGES};
use super::error::{BabelError, BabelResult};

/// A unique address in the Library of Babel
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BabelAddress {
    /// The hexagon identifier (base-36 string)
    pub hexagon: String,
    /// Wall number (1-4)
    pub wall: u8,
    /// Shelf number (1-5)
    pub shelf: u8,
    /// Volume number (1-32)
    pub volume: u8,
    /// Page number (1-410)
    pub page: u16,
}

impl BabelAddress {
    /// Create a new BabelAddress
    pub fn new(hexagon: String, wall: u8, shelf: u8, volume: u8, page: u16) -> Self {
        Self { hexagon, wall, shelf, volume, page }
    }

    /// Validate the address components are within valid ranges
    pub fn validate(&self) -> BabelResult<()> {
        if self.wall < 1 || self.wall > WALLS as u8 {
            return Err(BabelError::InvalidAddressComponent {
                component: "wall",
                value: self.wall as u64,
                min: 1,
                max: WALLS,
            });
        }
        if self.shelf < 1 || self.shelf > SHELVES as u8 {
            return Err(BabelError::InvalidAddressComponent {
                component: "shelf",
                value: self.shelf as u64,
                min: 1,
                max: SHELVES,
            });
        }
        if self.volume < 1 || self.volume > VOLUMES as u8 {
            return Err(BabelError::InvalidAddressComponent {
                component: "volume",
                value: self.volume as u64,
                min: 1,
                max: VOLUMES,
            });
        }
        if self.page < 1 || self.page > PAGES as u16 {
            return Err(BabelError::InvalidAddressComponent {
                component: "page",
                value: self.page as u64,
                min: 1,
                max: PAGES,
            });
        }
        if self.hexagon.is_empty() {
            return Err(BabelError::EmptyHexagon);
        }
        // Validate hexagon is valid base-36 (0-9, a-z)
        for c in self.hexagon.chars() {
            if !c.is_ascii_digit() && !(c >= 'a' && c <= 'z') {
                return Err(BabelError::InvalidHexagonCharacter(c));
            }
        }
        Ok(())
    }
}

impl std::fmt::Display for BabelAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}:{}:{}:{}:{}",
            self.hexagon, self.wall, self.shelf, self.volume, self.page
        )
    }
}


/// Base-36 alphabet for hexagon encoding
const BASE36_ALPHABET: &str = "0123456789abcdefghijklmnopqrstuvwxyz";

/// Convert a BigInt to a base-36 string
fn bigint_to_base36(num: &BigUint) -> String {
    if num.is_zero() {
        return "0".to_string();
    }
    
    let base = BigUint::from(36u32);
    let mut remaining = num.clone();
    let mut chars: Vec<char> = Vec::new();
    let alphabet_chars: Vec<char> = BASE36_ALPHABET.chars().collect();
    
    while remaining > BigUint::zero() {
        let index = (&remaining % &base).to_usize().unwrap_or(0);
        remaining = &remaining / &base;
        chars.push(alphabet_chars[index]);
    }
    
    chars.reverse();
    chars.into_iter().collect()
}

/// Convert a base-36 string to BigInt
fn base36_to_bigint(hex: &str) -> BigUint {
    let base = BigUint::from(36u32);
    let mut result = BigUint::zero();
    
    for c in hex.chars() {
        let index = BASE36_ALPHABET.chars().position(|x| x == c).unwrap_or(0);
        result = result * &base + BigUint::from(index as u32);
    }
    
    result
}

/// Encode a text number (base-29 BigInt) to a BabelAddress
///
/// The encoding works as follows:
/// 1. The text_num represents the page content as a base-29 number
/// 2. We pick a default location (wall=1, shelf=1, volume=1, page=1 -> index 0)
/// 3. The hexagon is simply the text_num in base-36
///
/// This creates a direct mapping: each unique text gets a unique address
pub fn encode_to_address(text_num: &BigUint) -> BabelAddress {
    // For simplicity, we use location 0 (wall=1, shelf=1, volume=1, page=1)
    // The hexagon directly encodes the text
    let hexagon = bigint_to_base36(text_num);
    
    BabelAddress {
        hexagon,
        wall: 1,
        shelf: 1,
        volume: 1,
        page: 1,
    }
}

/// Decode a BabelAddress back to a text number (base-29 BigInt)
///
/// Reverses the encoding to get back the original text number
pub fn decode_from_address(addr: &BabelAddress) -> BigUint {
    // The hexagon directly contains the text number in base-36
    base36_to_bigint(&addr.hexagon)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_address_validation() {
        let addr = BabelAddress::new("abc123".to_string(), 1, 1, 1, 1);
        assert!(addr.validate().is_ok());
        
        let addr = BabelAddress::new("abc123".to_string(), 0, 1, 1, 1);
        assert!(addr.validate().is_err());
        
        let addr = BabelAddress::new("abc123".to_string(), 5, 1, 1, 1);
        assert!(addr.validate().is_err());
    }

    #[test]
    fn test_address_roundtrip() {
        let original = BigUint::from(12345678u64);
        let addr = encode_to_address(&original);
        let recovered = decode_from_address(&addr);
        assert_eq!(original, recovered);
    }

    #[test]
    fn test_base36_roundtrip() {
        let original = BigUint::from(987654321u64);
        let base36 = bigint_to_base36(&original);
        let recovered = base36_to_bigint(&base36);
        assert_eq!(original, recovered);
    }
}

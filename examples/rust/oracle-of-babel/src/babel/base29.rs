//! Base-29 encoding/decoding for Library of Babel text
//!
//! Converts text to/from BigInt using the 29-character alphabet

use num_bigint::BigUint;
use num_traits::{Zero, ToPrimitive};
use super::ALPHABET;

/// Convert text to BigInt using base-29 encoding
///
/// Each character maps to its index in ALPHABET (0-28)
/// The resulting BigInt represents the text as a base-29 number
pub fn text_to_bigint(text: &str) -> BigUint {
    let base = BigUint::from(29u32);
    let mut result = BigUint::zero();
    
    for c in text.chars() {
        let index = ALPHABET.chars().position(|x| x == c).unwrap_or(0);
        result = result * &base + BigUint::from(index as u32);
    }
    
    result
}

/// Convert BigInt back to text using base-29 decoding
///
/// The length parameter ensures we get exactly that many characters,
/// including leading "spaces" (index 0 in alphabet)
pub fn bigint_to_text(num: &BigUint, length: usize) -> String {
    let base = BigUint::from(29u32);
    let mut remaining = num.clone();
    let mut chars: Vec<char> = Vec::with_capacity(length);
    let alphabet_chars: Vec<char> = ALPHABET.chars().collect();
    
    // Extract digits from least significant to most significant
    while remaining > BigUint::zero() {
        let index = (&remaining % &base).to_usize().unwrap_or(0);
        remaining = &remaining / &base;
        chars.push(alphabet_chars[index]);
    }
    
    // Pad with spaces (index 0) if needed
    while chars.len() < length {
        chars.push(alphabet_chars[0]);
    }
    
    // Truncate if too long
    chars.truncate(length);
    
    // Reverse since we extracted digits in reverse order
    chars.reverse();
    chars.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_string() {
        let num = text_to_bigint("");
        assert_eq!(num, BigUint::zero());
    }

    #[test]
    fn test_single_char() {
        // 'a' is at index 1
        let num = text_to_bigint("a");
        assert_eq!(num, BigUint::from(1u32));
        
        // space is at index 0
        let num = text_to_bigint(" ");
        assert_eq!(num, BigUint::zero());
    }

    #[test]
    fn test_roundtrip() {
        let original = "hello world";
        let num = text_to_bigint(original);
        let result = bigint_to_text(&num, original.len());
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_with_punctuation() {
        let original = "hello, world.";
        let num = text_to_bigint(original);
        let result = bigint_to_text(&num, original.len());
        assert_eq!(result, original);
    }

    #[test]
    fn test_padding() {
        let num = text_to_bigint("hi");
        let result = bigint_to_text(&num, 10);
        assert_eq!(result.len(), 10);
        assert!(result.ends_with("hi"));
    }
}

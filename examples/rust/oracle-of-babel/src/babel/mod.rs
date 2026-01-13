//! Library of Babel core algorithm
//!
//! Implements deterministic text <-> address conversion inspired by
//! the Library of Babel concept by Jorge Luis Borges.
//!
//! Algorithm:
//! - Page text is treated as a base-29 number
//! - Hexagon address is the result encoded in base-36

mod base29;
mod address;
mod permutation;
mod error;

pub use address::BabelAddress;
pub use error::{BabelError, BabelResult};
use permutation::Permutation;

/// The 29-character alphabet used by the Library of Babel
/// Order: space, a-z, comma, period (matching libraryofbabel.info)
pub const ALPHABET: &str = " abcdefghijklmnopqrstuvwxyz,.";

/// Number of characters per page
pub const PAGE_LENGTH: usize = 3200;

/// Maximum hexagon name length (base-36)
pub const HEXAGON_LENGTH: usize = 3260;

/// Library dimensions
pub const WALLS: u64 = 4;
pub const SHELVES: u64 = 5;
pub const VOLUMES: u64 = 32;
pub const PAGES: u64 = 410;

/// Total locations per hexagon
pub const LOCATIONS_PER_HEXAGON: u64 = WALLS * SHELVES * VOLUMES * PAGES;

/// Library of Babel operations
pub struct BabelLibrary;

impl BabelLibrary {
    /// Search for text and return its address in the Library
    ///
    /// The text is padded to 3200 characters, converted to a BigInt (base-29),
    /// then combined with a location offset and converted to hex address (base-36).
    pub fn search(text: &str) -> BabelResult<BabelAddress> {
        // Validate and normalize input
        let normalized = Self::normalize_text(text)?;
        
        // Pad to full page length
        let padded = Self::pad_text(&normalized);
        
        // Convert text to BigInt (base-29)
        let text_num = base29::text_to_bigint(&padded);
        
        // Permute the number (scramble)
        let permuted_num = Permutation::forward(&text_num);
        
        // Convert to address using the encoding scheme
        Ok(address::encode_to_address(&permuted_num))
    }

    /// Retrieve the page content at a given address
    ///
    /// Reverses the encoding: address -> BigInt -> text
    pub fn get_page(addr: &BabelAddress) -> BabelResult<String> {
        // Validate address
        addr.validate()?;
        
        // Decode address back to text number
        let permuted_num = address::decode_from_address(addr);
        
        // Reverse the permutation
        let text_num = Permutation::reverse(&permuted_num);
        
        // Convert BigInt back to text
        let text = base29::bigint_to_text(&text_num, PAGE_LENGTH);
        
        Ok(text)
    }

    /// Normalize text to lowercase and validate characters
    fn normalize_text(text: &str) -> BabelResult<String> {
        let normalized: String = text.to_lowercase();
        
        // Validate all characters are in our alphabet
        for c in normalized.chars() {
            if !ALPHABET.contains(c) {
                return Err(BabelError::InvalidCharacter(c));
            }
        }
        
        if normalized.len() > PAGE_LENGTH {
            return Err(BabelError::TextTooLong {
                actual: normalized.len(),
                max: PAGE_LENGTH,
            });
        }
        
        Ok(normalized)
    }

    /// Pad text to exactly PAGE_LENGTH characters
    ///
    /// Uses spaces for padding (position 0 in alphabet)
    fn pad_text(text: &str) -> String {
        if text.len() >= PAGE_LENGTH {
            return text[..PAGE_LENGTH].to_string();
        }
        
        let mut result = text.to_string();
        let padding_needed = PAGE_LENGTH - text.len();
        
        // Use spaces for padding (position 0 in alphabet)
        result.push_str(&" ".repeat(padding_needed));
        
        result
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    // ==================== Roundtrip Tests ====================
    // The core property: search(text) -> address -> get_page(address) contains text

    #[test]
    fn test_roundtrip_hello_world() {
        let original = "hello world";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        // The page should contain our text
        assert!(
            page.contains(original),
            "Page should contain '{}', but got: {}...",
            original,
            &page[..100.min(page.len())]
        );
    }

    #[test]
    fn test_roundtrip_with_punctuation() {
        let original = "hello, world.";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert!(
            page.contains(original),
            "Page should contain '{}'",
            original
        );
    }

    #[test]
    fn test_roundtrip_long_text() {
        let original = "the quick brown fox jumps over the lazy dog";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert!(
            page.contains(original),
            "Page should contain the full sentence"
        );
    }

    #[test]
    fn test_roundtrip_single_character() {
        let original = "a";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert!(
            page.contains(original),
            "Page should contain single character 'a'"
        );
    }

    #[test]
    fn test_roundtrip_only_spaces() {
        let original = "   ";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        // Page should be all spaces (since we pad with spaces)
        assert_eq!(page.len(), PAGE_LENGTH);
    }

    #[test]
    fn test_roundtrip_special_phrase() {
        // A meaningful phrase that should be findable
        let original = "to be or not to be, that is the question.";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert!(
            page.contains(original),
            "Shakespeare quote should be on the page"
        );
    }

    // ==================== Determinism Tests ====================
    // Same input must always produce the same output

    #[test]
    fn test_deterministic_search() {
        let text = "the quick brown fox";
        let addr1 = BabelLibrary::search(text).unwrap();
        let addr2 = BabelLibrary::search(text).unwrap();
        
        assert_eq!(addr1.hexagon, addr2.hexagon, "Hexagon should be deterministic");
        assert_eq!(addr1.wall, addr2.wall, "Wall should be deterministic");
        assert_eq!(addr1.shelf, addr2.shelf, "Shelf should be deterministic");
        assert_eq!(addr1.volume, addr2.volume, "Volume should be deterministic");
        assert_eq!(addr1.page, addr2.page, "Page should be deterministic");
    }

    #[test]
    fn test_deterministic_page_retrieval() {
        let text = "testing determinism";
        let address = BabelLibrary::search(text).unwrap();
        
        let page1 = BabelLibrary::get_page(&address).unwrap();
        let page2 = BabelLibrary::get_page(&address).unwrap();
        
        assert_eq!(page1, page2, "Same address should always return same page");
    }

    // ==================== Page Content Tests ====================

    #[test]
    fn test_page_length_is_correct() {
        let address = BabelLibrary::search("test").unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert_eq!(
            page.len(),
            PAGE_LENGTH,
            "Page should be exactly {} characters",
            PAGE_LENGTH
        );
    }

    #[test]
    fn test_page_contains_only_valid_characters() {
        let address = BabelLibrary::search("test").unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        for c in page.chars() {
            assert!(
                ALPHABET.contains(c),
                "Page should only contain valid alphabet chars, found '{}'",
                c
            );
        }
    }

    #[test]
    fn test_text_appears_at_start_when_padded() {
        // When we pad with spaces, the original text should appear at the start
        let original = "hello";
        let address = BabelLibrary::search(original).unwrap();
        let page = BabelLibrary::get_page(&address).unwrap();
        
        assert!(
            page.starts_with(original),
            "Padded text should appear at the start of the page"
        );
    }

    // ==================== Address Validity Tests ====================

    #[test]
    fn test_address_components_in_valid_range() {
        let address = BabelLibrary::search("test address").unwrap();
        
        assert!(address.wall >= 1 && address.wall <= 4, "Wall should be 1-4");
        assert!(address.shelf >= 1 && address.shelf <= 5, "Shelf should be 1-5");
        assert!(address.volume >= 1 && address.volume <= 32, "Volume should be 1-32");
        assert!(address.page >= 1 && address.page <= 410, "Page should be 1-410");
        assert!(!address.hexagon.is_empty(), "Hexagon should not be empty");
    }

    #[test]
    fn test_address_has_valid_hexagon_format() {
        let address = BabelLibrary::search("hexagon test").unwrap();
        
        // Hexagon should only contain base-36 chars (0-9, a-z)
        for c in address.hexagon.chars() {
            assert!(
                c.is_ascii_digit() || (c >= 'a' && c <= 'z'),
                "Hexagon should only contain 0-9 or a-z, found '{}'",
                c
            );
        }
    }

    // ==================== Input Validation Tests ====================

    #[test]
    fn test_invalid_characters_rejected() {
        let result = BabelLibrary::search("hello123");
        assert!(result.is_err(), "Numbers should be rejected");
        
        let result = BabelLibrary::search("hello!");
        assert!(result.is_err(), "Exclamation should be rejected");
        
        let result = BabelLibrary::search("hello?");
        assert!(result.is_err(), "Question mark should be rejected");
    }

    #[test]
    fn test_uppercase_normalized_to_lowercase() {
        let upper = "HELLO WORLD";
        let lower = "hello world";
        
        let addr_upper = BabelLibrary::search(upper).unwrap();
        let addr_lower = BabelLibrary::search(lower).unwrap();
        
        // Both should produce the same address
        assert_eq!(addr_upper.hexagon, addr_lower.hexagon);
        assert_eq!(addr_upper.wall, addr_lower.wall);
    }

    #[test]
    fn test_empty_string_allowed() {
        let result = BabelLibrary::search("");
        assert!(result.is_ok(), "Empty string should be allowed");
        
        let page = BabelLibrary::get_page(&result.unwrap()).unwrap();
        assert_eq!(page.len(), PAGE_LENGTH, "Empty search should return full page");
    }

    // ==================== Different Inputs Produce Different Addresses ====================

    #[test]
    fn test_different_texts_different_addresses() {
        let addr1 = BabelLibrary::search("hello").unwrap();
        let addr2 = BabelLibrary::search("world").unwrap();
        
        // At least one component should differ
        let same = addr1.hexagon == addr2.hexagon
            && addr1.wall == addr2.wall
            && addr1.shelf == addr2.shelf
            && addr1.volume == addr2.volume
            && addr1.page == addr2.page;
        
        assert!(!same, "Different texts should produce different addresses");
    }

    #[test]
    fn test_similar_texts_different_addresses() {
        // Even similar texts should map to different locations
        let addr1 = BabelLibrary::search("hello").unwrap();
        let addr2 = BabelLibrary::search("hellp").unwrap(); // One letter different
        
        let same = addr1.hexagon == addr2.hexagon
            && addr1.wall == addr2.wall
            && addr1.shelf == addr2.shelf
            && addr1.volume == addr2.volume
            && addr1.page == addr2.page;
        
        assert!(!same, "Similar texts should still produce different addresses");
    }
}

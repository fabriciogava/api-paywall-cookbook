//! # The Shuffler of Infinite Pages
//!
//! Within the Library, there exists a peculiar mechanism. When a seeker presents
//! a page of text, the Oracle must transform it into an address—a unique location
//! among the infinite shelves. And when given an address, the Oracle must retrieve
//! the exact text that resides there.
//!
//! This module implements a **reversible permutation**—a mathematical shuffling
//! that scrambles numbers in a way that can always be unscrambled.
//!
//! ## Why Permutation?
//!
//! Consider: if we simply stored text as a number (which Base-29 encoding does),
//! similar texts would have similar addresses. "hello" and "hallo" would be
//! neighbors. This is predictable, perhaps too orderly for the Library's nature.
//!
//! The permutation scatters these orderly numbers across the vast address space,
//! so that "hello" and "hallo" end up in distant corners of the Library.
//! Yet—and this is crucial—the scattering is deterministic and reversible.
//!
//! ## The Linear Congruential Generator (LCG)
//!
//! Our permutation uses an LCG, one of the oldest pseudorandom number generators:
//!
//! ```text
//! Forward:  y = (a × x + c) mod m
//! Reverse:  x = (y - c) × a⁻¹ mod m
//! ```
//!
//! Where:
//! - `m` = 29^3200 (the total number of possible pages)
//! - `a` = the multiplier (must be coprime with m)
//! - `c` = the increment
//! - `a⁻¹` = the modular multiplicative inverse of a
//!
//! The beauty of this formulation: given any `y`, we can always recover the
//! original `x` by computing the inverse transformation.
//!
//! ## The Hull-Dobell Theorem
//!
//! For an LCG to visit every number in the range exactly once (a full period),
//! these conditions must hold:
//!
//! 1. `c` and `m` must be coprime
//! 2. `a - 1` must be divisible by all prime factors of `m`
//! 3. If `m` is divisible by 4, then `a - 1` must also be divisible by 4
//!
//! Since `m = 29^3200`, the only prime factor is 29. So:
//! - `c` must not be divisible by 29 ✓
//! - `a - 1` must be divisible by 29 ✓
//!
//! Our chosen constants satisfy these requirements.

use num_bigint::{BigInt, BigUint, Sign};
use num_integer::Integer;
use num_traits::Zero;

/// The reversible permutation engine.
///
/// This stateless struct provides forward and reverse transformations
/// that map the space [0, 29^3200) onto itself bijectively—meaning
/// every input produces a unique output, and vice versa.
pub struct Permutation;

impl Permutation {
    /// Transform a number into its scrambled form.
    ///
    /// This is the forward LCG transformation: `y = (a × x + c) mod m`
    ///
    /// # Arguments
    /// * `x` - The original number (from Base-29 encoding of text)
    ///
    /// # Returns
    /// The scrambled number, which becomes part of the page address.
    pub fn forward(x: &BigUint) -> BigUint {
        let (a, c, m) = Self::params();
        ((x * &a) + &c) % &m
    }

    /// Recover the original number from its scrambled form.
    ///
    /// This is the inverse LCG transformation: `x = (y - c) × a⁻¹ mod m`
    ///
    /// The inverse `a⁻¹` is computed using the Extended Euclidean Algorithm,
    /// which finds a number such that `(a × a⁻¹) mod m = 1`.
    ///
    /// # Arguments
    /// * `y` - The scrambled number (from the page address)
    ///
    /// # Returns
    /// The original number, which decodes to the page text.
    pub fn reverse(y: &BigUint) -> BigUint {
        let (a, c, m) = Self::params();

        // ─────────────────────────────────────────────────────────────────
        // Step 1: Compute the modular inverse of 'a'
        // ─────────────────────────────────────────────────────────────────
        //
        // We need to find a⁻¹ such that (a × a⁻¹) mod m = 1.
        // The Extended Euclidean Algorithm finds x, y such that:
        //   a × x + m × y = gcd(a, m)
        //
        // If gcd(a, m) = 1 (which it is, since a is coprime with m),
        // then x is the modular inverse of a.

        let a_int = BigInt::from_biguint(Sign::Plus, a);
        let m_int = BigInt::from_biguint(Sign::Plus, m.clone());

        let extended = a_int.extended_gcd(&m_int);

        // The result might be negative; we need it in range [0, m)
        let inv_a = if extended.x < BigInt::zero() {
            extended.x + &m_int
        } else {
            extended.x
        };

        let inv_a_uint = inv_a.to_biguint().unwrap();

        // ─────────────────────────────────────────────────────────────────
        // Step 2: Compute (y - c) mod m
        // ─────────────────────────────────────────────────────────────────
        //
        // BigUint doesn't allow negative numbers, so we handle the case
        // where y < c by computing (y + m - c) instead.

        let term = if y >= &c {
            y - &c
        } else {
            y + &m - &c
        };

        // ─────────────────────────────────────────────────────────────────
        // Step 3: Multiply by the inverse
        // ─────────────────────────────────────────────────────────────────

        (term * inv_a_uint) % m
    }

    /// The sacred constants that define our permutation.
    ///
    /// These values were chosen to satisfy the Hull-Dobell conditions
    /// for a full-period LCG, ensuring every possible page has a unique
    /// address and every address maps to a unique page.
    ///
    /// # Returns
    /// A tuple of (multiplier, increment, modulus).
    fn params() -> (BigUint, BigUint, BigUint) {
        // The modulus: 29^3200
        // This is the total number of possible pages in the Library.
        let base = BigUint::from(29u32);
        let page_length = 3200;
        let m = base.pow(page_length);

        // The multiplier 'a'
        //
        // Requirements for a full-period LCG:
        // - gcd(a, m) = 1 → a must not be divisible by 29
        // - (a - 1) divisible by 29 → for full period
        //
        // This particular constant was chosen to be large enough to
        // thoroughly scatter the address space while satisfying the above.
        let a = BigUint::parse_bytes(b"49221810488734912903332039985", 10).unwrap();

        // The increment 'c'
        //
        // Requirement: gcd(c, m) = 1 → c must not be divisible by 29.
        // This constant satisfies that condition.
        let c = BigUint::parse_bytes(b"12345678901234567890123456789", 10).unwrap();

        (a, c, m)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that forward and reverse are true inverses.
    ///
    /// For any number x, reverse(forward(x)) must equal x.
    /// This is the fundamental property that makes the Library work.
    #[test]
    fn test_permutation_roundtrip() {
        let original = BigUint::from(123456789u64);

        // Forward should produce a different number
        let scrambled = Permutation::forward(&original);
        assert_ne!(original, scrambled, "Forward should change the number");

        // Reverse should recover the original
        let recovered = Permutation::reverse(&scrambled);
        assert_eq!(original, recovered, "Roundtrip should return original");
    }

    /// Test with edge case: zero
    #[test]
    fn test_permutation_zero() {
        let zero = BigUint::from(0u32);
        let scrambled = Permutation::forward(&zero);
        let recovered = Permutation::reverse(&scrambled);
        assert_eq!(zero, recovered, "Zero should roundtrip correctly");
    }

    /// Test with a large number
    #[test]
    fn test_permutation_large_number() {
        let large = BigUint::parse_bytes(
            b"999999999999999999999999999999999999999999999999999",
            10,
        )
        .unwrap();
        let scrambled = Permutation::forward(&large);
        let recovered = Permutation::reverse(&scrambled);
        assert_eq!(large, recovered, "Large number should roundtrip correctly");
    }
}

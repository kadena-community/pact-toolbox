use bumpalo::Bump;
use compact_str::CompactString;
use smallvec::SmallVec;
use std::cell::RefCell;
use string_interner::{DefaultSymbol, StringInterner, DefaultBackend};

/// Arena-based allocator for AST nodes to minimize allocations
pub struct Arena {
    pub bump: Bump,
    pub interner: RefCell<StringInterner<DefaultBackend>>,
}

impl Arena {
    pub fn new() -> Self {
        Self {
            bump: Bump::new(),
            interner: RefCell::new(StringInterner::new()),
        }
    }

    /// Intern a string to reduce memory usage for repeated identifiers
    pub fn intern_string(&self, s: &str) -> DefaultSymbol {
        self.interner.borrow_mut().get_or_intern(s)
    }

    /// Get interned string back
    pub fn resolve_string(&self, symbol: DefaultSymbol) -> Option<String> {
        self.interner.borrow().resolve(symbol).map(|s| s.to_string())
    }

    /// Allocate a slice in the arena
    pub fn alloc_slice<T>(&self, slice: &[T]) -> &[T]
    where
        T: Copy,
    {
        self.bump.alloc_slice_copy(slice)
    }

    /// Allocate a string slice in the arena
    pub fn alloc_str(&self, s: &str) -> &str {
        self.bump.alloc_str(s)
    }
}

impl Default for Arena {
    fn default() -> Self {
        Self::new()
    }
}

/// Optimized string type that uses compact representation
pub type OptString = CompactString;

/// Optimized vector type that avoids allocations for small collections
pub type OptVec<T> = SmallVec<[T; 4]>;

/// Symbol type for interned strings
pub type Symbol = DefaultSymbol;

/// Fast string creation from &str
#[inline]
pub fn opt_string(s: &str) -> OptString {
    CompactString::new(s)
}

/// Create an optimized vector
#[inline]
pub fn opt_vec<T>() -> OptVec<T> {
    SmallVec::new()
}

/// Fast string building with capacity hint
#[inline]
pub fn opt_string_with_capacity(capacity: usize) -> OptString {
    CompactString::with_capacity(capacity)
}

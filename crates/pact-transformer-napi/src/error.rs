use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

/// Represents a parsing error with location information
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseError {
    pub message: String,
    pub line: u32,
    pub column: u32,
}

/// Error types for the transformer
#[derive(Debug, thiserror::Error)]
pub enum TransformerError {
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Tree-sitter error: {0}")]
    TreeSitterError(String),

    #[error("Invalid node structure: {0}")]
    InvalidNode(String),

    #[error("Missing required field: {0}")]
    MissingField(String),
}

impl From<TransformerError> for napi::Error {
    fn from(err: TransformerError) -> Self {
        match err {
            TransformerError::ParseError(msg) => napi::Error::new(Status::InvalidArg, msg),
            TransformerError::TreeSitterError(msg) => napi::Error::new(Status::GenericFailure, msg),
            TransformerError::InvalidNode(msg) => napi::Error::new(Status::InvalidArg, msg),
            TransformerError::MissingField(msg) => napi::Error::new(Status::InvalidArg, msg),
        }
    }
}

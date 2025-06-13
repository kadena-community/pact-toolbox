use napi::Error as NapiError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TransformError {
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Code generation error: {0}")]
    CodeGenError(String),

    #[error("Type error: {0}")]
    TypeError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

pub type TransformResult<T> = Result<T, TransformError>;

impl From<TransformError> for NapiError {
    fn from(err: TransformError) -> Self {
        NapiError::from_reason(err.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct ParseError {
    pub message: String,
    pub line: usize,
    pub column: usize,
}

impl ParseError {
    pub fn new(message: String, line: usize, column: usize) -> Self {
        Self { message, line, column }
    }
}

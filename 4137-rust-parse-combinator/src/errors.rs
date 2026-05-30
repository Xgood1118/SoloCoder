//! Error types for the parser combinator library.

use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use core::fmt;

/// Represents a span in the input text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    /// The start byte position.
    pub start: usize,
    /// The end byte position (exclusive).
    pub end: usize,
}

impl Span {
    /// Create a new span from start to end.
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }

    /// Get the line and column numbers for this span.
    pub fn line_col(&self, input: &str) -> (usize, usize, usize, usize) {
        let mut start_line = 1;
        let mut start_col = 1;
        let mut end_line = 1;
        let mut end_col = 1;

        for (i, c) in input.char_indices() {
            if i < self.start {
                if c == '\n' {
                    start_line += 1;
                    start_col = 1;
                } else {
                    start_col += 1;
                }
            }
            if i < self.end {
                if c == '\n' {
                    end_line += 1;
                    end_col = 1;
                } else {
                    end_col += 1;
                }
            } else {
                break;
            }
        }

        (start_line, start_col, end_line, end_col)
    }
}

impl fmt::Display for Span {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}..{}", self.start, self.end)
    }
}

/// The type of error that occurred during parsing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorKind {
    /// Expected a specific character.
    ExpectedChar(char),
    /// Expected a specific string.
    ExpectedString(&'static str),
    /// Expected a character satisfying a predicate.
    ExpectedSatisfy,
    /// Expected one of a set of characters.
    ExpectedOneOf(String),
    /// Expected end of input.
    ExpectedEof,
    /// Unexpected end of input.
    UnexpectedEof,
    /// Custom error message.
    Custom(String),
    /// Cut point reached - don't try alternatives.
    Cut,
}

/// A parse error with position information.
#[derive(Debug, Clone)]
pub struct ParseError<'a> {
    /// The span where the error occurred.
    pub span: Span,
    /// The type of error.
    pub kind: ErrorKind,
    /// The input string (for context).
    pub input: &'a str,
    /// Context messages for better error reporting.
    pub context: Vec<String>,
}

impl<'a> ParseError<'a> {
    /// Create a new parse error.
    pub fn new(span: Span, kind: ErrorKind, input: &'a str) -> Self {
        Self {
            span,
            kind,
            input,
            context: Vec::new(),
        }
    }

    /// Add context to this error.
    pub fn with_context(mut self, ctx: String) -> Self {
        self.context.push(ctx);
        self
    }

    /// Check if this error is a cut error.
    pub fn is_cut(&self) -> bool {
        matches!(self.kind, ErrorKind::Cut)
    }

    /// Get a user-friendly error message.
    pub fn message(&self) -> String {
        match &self.kind {
            ErrorKind::ExpectedChar(c) => format!("expected character '{}'", c),
            ErrorKind::ExpectedString(s) => format!("expected string \"{}\"", s),
            ErrorKind::ExpectedSatisfy => "expected character satisfying condition".to_string(),
            ErrorKind::ExpectedOneOf(chars) => format!("expected one of \"{}\"", chars),
            ErrorKind::ExpectedEof => "expected end of input".to_string(),
            ErrorKind::UnexpectedEof => "unexpected end of input".to_string(),
            ErrorKind::Custom(msg) => msg.clone(),
            ErrorKind::Cut => "parse error".to_string(),
        }
    }

    /// Format the error with line and column information.
    pub fn format_with_position(&self) -> String {
        let (line, col, _, _) = self.span.line_col(self.input);
        let msg = self.message();

        let mut result = format!("{} at line {} column {}", msg, line, col);

        if !self.context.is_empty() {
            result.push_str("\nContext:");
            for ctx in &self.context {
                result.push_str("\n  - ");
                result.push_str(ctx);
            }
        }

        result
    }
}

impl<'a> fmt::Display for ParseError<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format_with_position())
    }
}

/// The result of a parse operation.
///
/// On success, returns a tuple of the parsed value and the new position.
/// On failure, returns a `ParseError`.
pub type ParseResult<'a, T> = Result<(T, usize), ParseError<'a>>;

/// Extension trait for `ParseResult` to add context.
pub trait ResultExt<T> {
    /// Add context to the error if there is one.
    fn with_context(self, ctx: String) -> Self;
}

impl<'a, T> ResultExt<T> for ParseResult<'a, T> {
    fn with_context(self, ctx: String) -> Self {
        self.map_err(|e| e.with_context(ctx))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_span_line_col() {
        let input = "hello\nworld\n";
        let span = Span::new(0, 5);
        assert_eq!(span.line_col(input), (1, 1, 1, 6));

        let span = Span::new(6, 11);
        assert_eq!(span.line_col(input), (2, 1, 2, 6));
    }

    #[test]
    fn test_error_message() {
        let input = "test";
        let err = ParseError::new(Span::new(0, 1), ErrorKind::ExpectedChar('a'), input);
        assert_eq!(err.message(), "expected character 'a'");
    }
}

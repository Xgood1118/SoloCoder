//! Primitive parser building blocks.

use crate::errors::{ErrorKind, ParseError, ParseResult, Span};
use crate::Parser;
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec;
use alloc::vec::Vec;
use core::fmt;
use core::marker::PhantomData;

// ============================================================================
// Character primitives
// ============================================================================

/// Parser that matches a single character.
#[derive(Debug, Clone, Copy)]
pub struct Char {
    c: char,
}

impl<'a> Parser<'a, char> for Char {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
        if pos >= input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let mut chars = input[pos..].chars();
        if let Some(c) = chars.next() {
            if c == self.c {
                Ok((c, pos + c.len_utf8()))
            } else {
                Err(ParseError::new(
                    Span::new(pos, pos + c.len_utf8()),
                    ErrorKind::ExpectedChar(self.c),
                    input,
                ))
            }
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ))
        }
    }
}

/// Match a single character.
pub fn char(c: char) -> Char {
    Char { c }
}

/// Parser that matches a character satisfying a predicate.
#[derive(Debug, Clone)]
pub struct Satisfy<F> {
    f: F,
}

impl<'a, F> Parser<'a, char> for Satisfy<F>
where
    F: Fn(char) -> bool,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
        if pos >= input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let mut chars = input[pos..].chars();
        if let Some(c) = chars.next() {
            if (self.f)(c) {
                Ok((c, pos + c.len_utf8()))
            } else {
                Err(ParseError::new(
                    Span::new(pos, pos + c.len_utf8()),
                    ErrorKind::ExpectedSatisfy,
                    input,
                ))
            }
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ))
        }
    }
}

/// Match a character satisfying a predicate.
pub fn satisfy<F: Fn(char) -> bool>(f: F) -> Satisfy<F> {
    Satisfy { f }
}

/// Parser that matches one of a set of characters.
#[derive(Debug, Clone, Copy)]
pub struct OneOf {
    chars: &'static str,
}

impl<'a> Parser<'a, char> for OneOf {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
        if pos >= input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let mut chars = input[pos..].chars();
        if let Some(c) = chars.next() {
            if self.chars.contains(c) {
                Ok((c, pos + c.len_utf8()))
            } else {
                Err(ParseError::new(
                    Span::new(pos, pos + c.len_utf8()),
                    ErrorKind::ExpectedOneOf(self.chars.to_string()),
                    input,
                ))
            }
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ))
        }
    }
}

/// Match one of the given characters.
pub fn one_of(chars: &'static str) -> OneOf {
    OneOf { chars }
}

/// Parser that matches none of a set of characters.
#[derive(Debug, Clone, Copy)]
pub struct NoneOf {
    chars: &'static str,
}

impl<'a> Parser<'a, char> for NoneOf {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
        if pos >= input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let mut chars = input[pos..].chars();
        if let Some(c) = chars.next() {
            if !self.chars.contains(c) {
                Ok((c, pos + c.len_utf8()))
            } else {
                Err(ParseError::new(
                    Span::new(pos, pos + c.len_utf8()),
                    ErrorKind::Custom(format!("expected character not in \"{}\"", self.chars)),
                    input,
                ))
            }
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ))
        }
    }
}

/// Match any character except those in the given set.
pub fn none_of(chars: &'static str) -> NoneOf {
    NoneOf { chars }
}

/// Parser that matches a literal string.
#[derive(Debug, Clone, Copy)]
pub struct Literal {
    s: &'static str,
}

impl<'a> Parser<'a, &'a str> for Literal {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, &'a str> {
        if pos + self.s.len() > input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        if input[pos..].starts_with(self.s) {
            Ok((&input[pos..pos + self.s.len()], pos + self.s.len()))
        } else {
            Err(ParseError::new(
                Span::new(pos, pos + self.s.len()),
                ErrorKind::ExpectedString(self.s),
                input,
            ))
        }
    }
}

/// Match a literal string.
pub fn string(s: &'static str) -> Literal {
    Literal { s }
}

/// Parser that matches a keyword (case-insensitive).
#[derive(Debug, Clone, Copy)]
pub struct Keyword {
    s: &'static str,
}

impl<'a> Parser<'a, &'a str> for Keyword {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, &'a str> {
        if pos + self.s.len() > input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let input_slice = &input[pos..pos + self.s.len()];
        if input_slice.eq_ignore_ascii_case(self.s) {
            Ok((&input[pos..pos + self.s.len()], pos + self.s.len()))
        } else {
            Err(ParseError::new(
                Span::new(pos, pos + self.s.len()),
                ErrorKind::ExpectedString(self.s),
                input,
            ))
        }
    }
}

/// Match a keyword (case-insensitive).
pub fn keyword(s: &'static str) -> Keyword {
    Keyword { s }
}

/// Parser that matches end of input.
#[derive(Debug, Clone, Copy)]
pub struct Eof;

impl<'a> Parser<'a, ()> for Eof {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, ()> {
        if pos >= input.len() {
            Ok(((), pos))
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::ExpectedEof,
                input,
            ))
        }
    }
}

/// Match end of input.
pub fn eof() -> Eof {
    Eof
}

/// Parser that matches any single character.
#[derive(Debug, Clone, Copy)]
pub struct AnyChar;

impl<'a> Parser<'a, char> for AnyChar {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
        if pos >= input.len() {
            return Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ));
        }

        let mut chars = input[pos..].chars();
        if let Some(c) = chars.next() {
            Ok((c, pos + c.len_utf8()))
        } else {
            Err(ParseError::new(
                Span::new(pos, pos),
                ErrorKind::UnexpectedEof,
                input,
            ))
        }
    }
}

/// Match any single character.
pub fn any_char() -> AnyChar {
    AnyChar
}

/// Parser that always succeeds with the given value.
#[derive(Debug, Clone, Copy)]
pub struct Success<T> {
    value: T,
}

impl<'a, T: Clone> Parser<'a, T> for Success<T> {
    fn parse(&self, _input: &'a str, pos: usize) -> ParseResult<'a, T> {
        Ok((self.value.clone(), pos))
    }
}

/// Create a parser that always succeeds with the given value.
pub fn success<T: Clone>(value: T) -> Success<T> {
    Success { value }
}

/// Parser that always fails with the given message.
#[derive(Debug, Clone)]
pub struct Fail {
    message: String,
}

impl<'a, T> Parser<'a, T> for Fail {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        Err(ParseError::new(
            Span::new(pos, pos),
            ErrorKind::Custom(self.message.clone()),
            input,
        ))
    }
}

/// Create a parser that always fails with the given message.
pub fn fail<T>(message: String) -> Fail {
    Fail { message }
}

// ============================================================================
// Combinator structs
// ============================================================================

/// Map parser output.
#[derive(Debug, Clone)]
pub struct Map<P, F, A> {
    pub(crate) parser: P,
    pub(crate) f: F,
    pub(crate) _marker: PhantomData<fn() -> A>,
}

impl<'a, P, F, T, A> Parser<'a, T> for Map<P, F, A>
where
    P: Parser<'a, A>,
    F: Fn(A) -> T,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        self.parser.parse(input, pos).map(|(out, pos)| ((self.f)(out), pos))
    }
}

/// Map parser output with a function that can fail.
#[derive(Debug, Clone)]
pub struct MapRes<P, F, A, E> {
    pub(crate) parser: P,
    pub(crate) f: F,
    pub(crate) _marker: PhantomData<fn() -> (A, E)>,
}

impl<'a, P, F, T, E, A> Parser<'a, T> for MapRes<P, F, A, E>
where
    P: Parser<'a, A>,
    F: Fn(A) -> Result<T, E>,
    E: fmt::Display,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.parser.parse(input, pos) {
            Ok((out, pos)) => match (self.f)(out) {
                Ok(t) => Ok((t, pos)),
                Err(e) => Err(ParseError::new(
                    Span::new(pos, pos),
                    ErrorKind::Custom(e.to_string()),
                    input,
                )),
            },
            Err(e) => Err(e),
        }
    }
}

/// Sequence two parsers using a function to create the second parser.
#[derive(Debug, Clone)]
pub struct AndThen<P, F, A> {
    pub(crate) parser: P,
    pub(crate) f: F,
    pub(crate) _marker: PhantomData<fn() -> A>,
}

impl<'a, P, F, Q, T, A> Parser<'a, T> for AndThen<P, F, A>
where
    P: Parser<'a, A>,
    F: Fn(A) -> Q,
    Q: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.parser.parse(input, pos) {
            Ok((out, pos)) => (self.f)(out).parse(input, pos),
            Err(e) => Err(e),
        }
    }
}

/// Sequence two parsers, keeping both outputs.
#[derive(Debug, Clone)]
pub struct Then<P, Q> {
    pub(crate) first: P,
    pub(crate) second: Q,
}

impl<'a, P, Q, A, B> Parser<'a, (A, B)> for Then<P, Q>
where
    P: Parser<'a, A>,
    Q: Parser<'a, B>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, (A, B)> {
        match self.first.parse(input, pos) {
            Ok((a, pos)) => match self.second.parse(input, pos) {
                Ok((b, pos)) => Ok(((a, b), pos)),
                Err(e) => Err(e),
            },
            Err(e) => Err(e),
        }
    }
}

/// Sequence two parsers, ignoring the second output.
#[derive(Debug, Clone)]
pub struct ThenIgnore<P, Q, B> {
    pub(crate) first: P,
    pub(crate) second: Q,
    pub(crate) _marker: PhantomData<fn() -> B>,
}

impl<'a, P, Q, A, B> Parser<'a, A> for ThenIgnore<P, Q, B>
where
    P: Parser<'a, A>,
    Q: Parser<'a, B>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, A> {
        match self.first.parse(input, pos) {
            Ok((a, pos)) => match self.second.parse(input, pos) {
                Ok((_, pos)) => Ok((a, pos)),
                Err(e) => Err(e),
            },
            Err(e) => Err(e),
        }
    }
}

/// Sequence two parsers, ignoring the first output.
#[derive(Debug, Clone)]
pub struct IgnoreThen<P, Q, A> {
    pub(crate) first: P,
    pub(crate) second: Q,
    pub(crate) _marker: PhantomData<fn() -> A>,
}

impl<'a, P, Q, A, B> Parser<'a, B> for IgnoreThen<P, Q, A>
where
    P: Parser<'a, A>,
    Q: Parser<'a, B>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, B> {
        match self.first.parse(input, pos) {
            Ok((_, pos)) => self.second.parse(input, pos),
            Err(e) => Err(e),
        }
    }
}

/// Try one parser, and if it fails, try another.
#[derive(Debug, Clone)]
pub struct Or<P, Q> {
    pub(crate) first: P,
    pub(crate) second: Q,
}

impl<'a, P, Q, T> Parser<'a, T> for Or<P, Q>
where
    P: Parser<'a, T>,
    Q: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.first.parse(input, pos) {
            Ok(v) => Ok(v),
            Err(e) => {
                if e.is_cut() {
                    return Err(e);
                }
                self.second.parse(input, pos)
            }
        }
    }
}

/// Choice combinator that tries multiple parsers.
#[derive(Debug, Clone)]
pub struct Choice<P> {
    parsers: Vec<P>,
}

impl<'a, P, T> Parser<'a, T> for Choice<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        let mut last_err = None;
        for parser in &self.parsers {
            match parser.parse(input, pos) {
                Ok(v) => return Ok(v),
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap_or_else(|| {
            ParseError::new(
                Span::new(pos, pos),
                ErrorKind::Custom("no choice matched".to_string()),
                input,
            )
        }))
    }
}

/// Try multiple parsers, returning the result of the first one that succeeds.
pub fn choice<P>(parsers: impl IntoIterator<Item = P>) -> Choice<P> {
    Choice {
        parsers: parsers.into_iter().collect(),
    }
}

/// Allow backtracking on parser failure.
#[derive(Debug, Clone)]
pub struct Try<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, T> for Try<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        self.parser.parse(input, pos)
    }
}

/// Mark a cut point - if this parser fails, don't try alternatives.
#[derive(Debug, Clone)]
pub struct Cut<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, T> for Cut<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.parser.parse(input, pos) {
            Ok(v) => Ok(v),
            Err(e) => {
                if e.is_cut() {
                    Err(e)
                } else {
                    Err(ParseError::new(e.span, ErrorKind::Cut, input))
                }
            }
        }
    }
}

/// Parse without consuming input.
#[derive(Debug, Clone)]
pub struct LookAhead<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, T> for LookAhead<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.parser.parse(input, pos) {
            Ok((v, _)) => Ok((v, pos)),
            Err(e) => Err(e),
        }
    }
}

/// Make a parser optional.
#[derive(Debug, Clone)]
pub struct Optional<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, Option<T>> for Optional<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Option<T>> {
        match self.parser.parse(input, pos) {
            Ok((v, pos)) => Ok((Some(v), pos)),
            Err(e) => {
                if e.is_cut() {
                    Err(e)
                } else {
                    Ok((None, pos))
                }
            }
        }
    }
}

/// Repeat a parser zero or more times.
#[derive(Debug, Clone)]
pub struct Many<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, Vec<T>> for Many<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Vec<T>> {
        let mut result = Vec::new();
        let mut current_pos = pos;

        loop {
            match self.parser.parse(input, current_pos) {
                Ok((v, new_pos)) => {
                    if new_pos == current_pos {
                        break;
                    }
                    result.push(v);
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }
        }

        Ok((result, current_pos))
    }
}

/// Repeat a parser one or more times.
#[derive(Debug, Clone)]
pub struct Many1<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, Vec<T>> for Many1<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Vec<T>> {
        let (first, mut current_pos) = self.parser.parse(input, pos)?;
        let mut result = vec![first];

        loop {
            match self.parser.parse(input, current_pos) {
                Ok((v, new_pos)) => {
                    if new_pos == current_pos {
                        break;
                    }
                    result.push(v);
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }
        }

        Ok((result, current_pos))
    }
}

/// Parse a list separated by a separator.
#[derive(Debug, Clone)]
pub struct SepBy<P, S, SepOut> {
    pub(crate) parser: P,
    pub(crate) separator: S,
    pub(crate) allow_trailing: bool,
    pub(crate) _marker: PhantomData<fn() -> SepOut>,
}

impl<'a, P, S, T, SepOut> Parser<'a, Vec<T>> for SepBy<P, S, SepOut>
where
    P: Parser<'a, T>,
    S: Parser<'a, SepOut>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Vec<T>> {
        let mut result = Vec::new();
        let mut current_pos = pos;

        match self.parser.parse(input, current_pos) {
            Ok((v, new_pos)) => {
                result.push(v);
                current_pos = new_pos;
            }
            Err(e) => {
                if e.is_cut() {
                    return Err(e);
                }
                return Ok((result, current_pos));
            }
        }

        loop {
            let sep_pos = current_pos;
            match self.separator.parse(input, current_pos) {
                Ok((_, new_pos)) => {
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }

            match self.parser.parse(input, current_pos) {
                Ok((v, new_pos)) => {
                    result.push(v);
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    if self.allow_trailing {
                        current_pos = sep_pos;
                    }
                    break;
                }
            }
        }

        Ok((result, current_pos))
    }
}

/// Parse a list separated by a separator, requiring at least one element.
#[derive(Debug, Clone)]
pub struct SepBy1<P, S, SepOut> {
    pub(crate) parser: P,
    pub(crate) separator: S,
    pub(crate) allow_trailing: bool,
    pub(crate) _marker: PhantomData<fn() -> SepOut>,
}

impl<'a, P, S, T, SepOut> Parser<'a, Vec<T>> for SepBy1<P, S, SepOut>
where
    P: Parser<'a, T>,
    S: Parser<'a, SepOut>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Vec<T>> {
        let (first, mut current_pos) = self.parser.parse(input, pos)?;
        let mut result = vec![first];

        loop {
            let sep_pos = current_pos;
            match self.separator.parse(input, current_pos) {
                Ok((_, new_pos)) => {
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }

            match self.parser.parse(input, current_pos) {
                Ok((v, new_pos)) => {
                    result.push(v);
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    if self.allow_trailing {
                        current_pos = sep_pos;
                    }
                    break;
                }
            }
        }

        Ok((result, current_pos))
    }
}

/// Skip a parser zero or more times.
#[derive(Debug, Clone)]
pub struct SkipMany<P, T> {
    pub(crate) parser: P,
    pub(crate) _marker: PhantomData<fn() -> T>,
}

impl<'a, P, T> Parser<'a, ()> for SkipMany<P, T>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, ()> {
        let mut current_pos = pos;

        loop {
            match self.parser.parse(input, current_pos) {
                Ok((_, new_pos)) => {
                    if new_pos == current_pos {
                        break;
                    }
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }
        }

        Ok(((), current_pos))
    }
}

/// Skip a parser one or more times.
#[derive(Debug, Clone)]
pub struct SkipMany1<P, T> {
    pub(crate) parser: P,
    pub(crate) _marker: PhantomData<fn() -> T>,
}

impl<'a, P, T> Parser<'a, ()> for SkipMany1<P, T>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, ()> {
        let (_, mut current_pos) = self.parser.parse(input, pos)?;

        loop {
            match self.parser.parse(input, current_pos) {
                Ok((_, new_pos)) => {
                    if new_pos == current_pos {
                        break;
                    }
                    current_pos = new_pos;
                }
                Err(e) => {
                    if e.is_cut() {
                        return Err(e);
                    }
                    break;
                }
            }
        }

        Ok(((), current_pos))
    }
}

/// Ensure the entire input is consumed.
#[derive(Debug, Clone)]
pub struct Complete<P> {
    pub(crate) parser: P,
}

impl<'a, P, T> Parser<'a, T> for Complete<P>
where
    P: Parser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        match self.parser.parse(input, pos) {
            Ok((v, pos)) => {
                if pos >= input.len() {
                    Ok((v, pos))
                } else {
                    Err(ParseError::new(
                        Span::new(pos, pos),
                        ErrorKind::ExpectedEof,
                        input,
                    ))
                }
            }
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Parser;

    #[test]
    fn test_char() {
        let parser = char('a');
        assert_eq!(parser.parse("abc", 0).unwrap(), ('a', 1));
        assert!(parser.parse("bcd", 0).is_err());
    }

    #[test]
    fn test_satisfy() {
        let parser = satisfy(|c| c.is_ascii_digit());
        assert_eq!(parser.parse("123", 0).unwrap(), ('1', 1));
        assert!(parser.parse("abc", 0).is_err());
    }

    #[test]
    fn test_one_of() {
        let parser = one_of("abc");
        assert_eq!(parser.parse("abc", 0).unwrap(), ('a', 1));
        assert_eq!(parser.parse("bcd", 0).unwrap(), ('b', 1));
        assert!(parser.parse("def", 0).is_err());
    }

    #[test]
    fn test_none_of() {
        let parser = none_of("abc");
        assert_eq!(parser.parse("def", 0).unwrap(), ('d', 1));
        assert!(parser.parse("abc", 0).is_err());
    }

    #[test]
    fn test_string() {
        let parser = string("hello");
        assert_eq!(parser.parse("hello world", 0).unwrap(), ("hello", 5));
        assert!(parser.parse("world hello", 0).is_err());
    }

    #[test]
    fn test_keyword() {
        let parser = keyword("if");
        assert_eq!(parser.parse("if", 0).unwrap(), ("if", 2));
        assert_eq!(parser.parse("IF", 0).unwrap(), ("IF", 2));
        assert_eq!(parser.parse("If", 0).unwrap(), ("If", 2));
    }

    #[test]
    fn test_eof() {
        let parser = eof();
        assert!(parser.parse("", 0).is_ok());
        assert!(parser.parse("abc", 0).is_err());
    }

    #[test]
    fn test_any_char() {
        let parser = any_char();
        assert_eq!(parser.parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(parser.parse("b", 0).unwrap(), ('b', 1));
        assert!(parser.parse("", 0).is_err());
    }

    #[test]
    fn test_success() {
        let parser = success(42);
        assert_eq!(parser.parse("anything", 0).unwrap(), (42, 0));
    }

    #[test]
    fn test_map() {
        let parser = char('a').map(|c| c.to_ascii_uppercase());
        assert_eq!(parser.parse("a", 0).unwrap(), ('A', 1));
    }

    #[test]
    fn test_then() {
        let parser = char('a').then(char('b'));
        assert_eq!(parser.parse("ab", 0).unwrap(), (('a', 'b'), 2));
    }

    #[test]
    fn test_then_ignore() {
        let parser = char('a').then_ignore(char('b'));
        assert_eq!(parser.parse("ab", 0).unwrap(), ('a', 2));
    }

    #[test]
    fn test_ignore_then() {
        let parser = char('a').ignore_then(char('b'));
        assert_eq!(parser.parse("ab", 0).unwrap(), ('b', 2));
    }

    #[test]
    fn test_or() {
        let parser = char('a').or(char('b'));
        assert_eq!(parser.parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(parser.parse("b", 0).unwrap(), ('b', 1));
        assert!(parser.parse("c", 0).is_err());
    }

    #[test]
    fn test_choice() {
        let parser = choice([char('a'), char('b'), char('c')]);
        assert_eq!(parser.parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(parser.parse("b", 0).unwrap(), ('b', 1));
        assert_eq!(parser.parse("c", 0).unwrap(), ('c', 1));
        assert!(parser.parse("d", 0).is_err());
    }

    #[test]
    fn test_optional() {
        let parser = char('a').optional();
        assert_eq!(parser.parse("a", 0).unwrap(), (Some('a'), 1));
        assert_eq!(parser.parse("b", 0).unwrap(), (None, 0));
    }

    #[test]
    fn test_many() {
        let parser = char('a').many();
        assert_eq!(parser.parse("aaa", 0).unwrap(), (vec!['a', 'a', 'a'], 3));
        assert_eq!(parser.parse("b", 0).unwrap(), (Vec::<char>::new(), 0));
    }

    #[test]
    fn test_many1() {
        let parser = char('a').many1();
        assert_eq!(parser.parse("aaa", 0).unwrap(), (vec!['a', 'a', 'a'], 3));
        assert!(parser.parse("b", 0).is_err());
    }

    #[test]
    fn test_skip_many() {
        let parser = char('a').skip_many();
        assert_eq!(parser.parse("aaa", 0).unwrap(), ((), 3));
        assert_eq!(parser.parse("b", 0).unwrap(), ((), 0));
    }

    #[test]
    fn test_complete() {
        let parser = char('a').complete();
        assert!(parser.parse("a", 0).is_ok());
        assert!(parser.parse("aa", 0).is_err());
    }
}

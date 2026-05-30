//! Higher-level parser combinators and common parsers.

use crate::errors::{ErrorKind, ParseError, ParseResult, Span};
use crate::primitives::*;
use crate::Parser;
use alloc::boxed::Box;
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use core::fmt;
use core::marker::PhantomData;
use core::str::FromStr;

pub use crate::primitives::{
    any_char, char, choice, eof, fail, keyword, none_of, one_of, satisfy, string, success,
    Choice, Complete, Cut, LookAhead, Many, Many1, Map, MapRes, Optional, Or, SepBy, SepBy1,
    SkipMany, SkipMany1, Then, ThenIgnore, IgnoreThen, Try,
};

// ============================================================================
// Choice helper - type-erased parser for when you need different types
// ============================================================================

/// A type-erased parser for use in choice-like situations.
pub type BoxParser<'a, T> = Box<dyn Parser<'a, T> + 'a>;

impl<'a, T> Parser<'a, T> for Box<dyn Parser<'a, T> + 'a> {
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        (**self).parse(input, pos)
    }
}

/// Try multiple parsers of potentially different types, using type erasure.
pub fn choice_boxed<'a, T>(
    parsers: impl IntoIterator<Item = BoxParser<'a, T>>,
) -> impl Parser<'a, T> + 'a
where
    T: 'a,
{
    struct ChoiceBoxed<'a, T>
    where
        T: 'a,
    {
        parsers: Vec<BoxParser<'a, T>>,
    }

    impl<'a, T> Parser<'a, T> for ChoiceBoxed<'a, T>
    where
        T: 'a,
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

    ChoiceBoxed {
        parsers: parsers.into_iter().collect(),
    }
}

// ============================================================================
// Character classes
// ============================================================================

/// Parse an ASCII digit.
pub fn digit<'a>() -> impl Parser<'a, char> {
    satisfy(|c| c.is_ascii_digit())
}

/// Parse an ASCII letter.
pub fn alpha<'a>() -> impl Parser<'a, char> {
    satisfy(|c| c.is_ascii_alphabetic())
}

/// Parse an ASCII alphanumeric character.
pub fn alphanum<'a>() -> impl Parser<'a, char> {
    satisfy(|c| c.is_ascii_alphanumeric())
}

/// Parse a whitespace character (space, tab, newline, carriage return).
pub fn whitespace<'a>() -> impl Parser<'a, char> {
    satisfy(|c| c.is_ascii_whitespace())
}

/// Parse a newline character.
pub fn newline<'a>() -> impl Parser<'a, char> {
    one_of("\n\r")
}

/// Parse zero or more whitespace characters.
pub fn multispace0<'a>() -> impl Parser<'a, ()> {
    whitespace().skip_many()
}

/// Parse one or more whitespace characters.
pub fn multispace1<'a>() -> impl Parser<'a, ()> {
    whitespace().skip_many1()
}

// ============================================================================
// Identifier parsing
// ============================================================================

/// Parse an identifier: letter or underscore followed by letters, digits, or underscores.
pub fn ident<'a>() -> impl Parser<'a, String> {
    satisfy(|c: char| c.is_ascii_alphabetic() || c == '_')
        .then(satisfy(|c: char| c.is_ascii_alphanumeric() || c == '_').many())
        .map(|(first, rest)| {
            let mut s = String::with_capacity(1 + rest.len());
            s.push(first);
            s.extend(rest);
            s
        })
}

// ============================================================================
// Number parsing
// ============================================================================

/// Parse an integer and convert it to a number type.
pub fn int<'a, T>() -> impl Parser<'a, T>
where
    T: FromStr + 'a,
    <T as FromStr>::Err: fmt::Display,
{
    digit()
        .many1()
        .map_res(|digits| {
            let s: String = digits.into_iter().collect();
            s.parse::<T>()
        })
}

/// Parse a number (integer or float) and convert it to a type.
pub fn number<'a, T>() -> impl Parser<'a, T>
where
    T: FromStr + 'a,
    <T as FromStr>::Err: fmt::Display,
{
    let integer = digit().many1();
    let decimal = char('.').then(digit().many());
    let exponent = one_of("eE").then(one_of("+-").optional()).then(digit().many1());

    integer
        .then(decimal.optional())
        .then(exponent.optional())
        .map_res(|((int_digits, dec_opt), exp_opt)| {
            let mut s = String::new();
            s.extend(int_digits);
            if let Some((dot, dec_digits)) = dec_opt {
                s.push(dot);
                s.extend(dec_digits);
            }
            if let Some(((e, sign), exp_digits)) = exp_opt {
                s.push(e);
                if let Some(sign_char) = sign {
                    s.push(sign_char);
                }
                s.extend(exp_digits);
            }
            s.parse::<T>()
        })
}

// ============================================================================
// String parsing
// ============================================================================

/// Parse a quoted string with escape sequences.
pub fn quoted_string<'a>() -> impl Parser<'a, String> {
    struct StringChar<E, N> {
        escaped: E,
        normal: N,
    }

    impl<'a, E, N> Parser<'a, char> for StringChar<E, N>
    where
        E: Parser<'a, char>,
        N: Parser<'a, char>,
    {
        fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, char> {
            match self.escaped.parse(input, pos) {
                Ok(v) => Ok(v),
                Err(e) => {
                    if e.is_cut() {
                        Err(e)
                    } else {
                        self.normal.parse(input, pos)
                    }
                }
            }
        }
    }

    let escaped = char('\\').then(any_char()).map(|(_backslash, c)| match c {
        'n' => '\n',
        't' => '\t',
        'r' => '\r',
        '\\' => '\\',
        '"' => '"',
        '\'' => '\'',
        c => c,
    });

    let normal = none_of("\"\\");
    let string_char = StringChar { escaped, normal };

    char('"')
        .then(string_char.many())
        .then(char('"'))
        .map(|((_open, chars), _close)| chars.into_iter().collect())
}

// ============================================================================
// Comment parsing
// ============================================================================

/// Parse a single-line comment starting with the given prefix.
pub fn line_comment<'a>(prefix: &'static str) -> impl Parser<'a, String> {
    string(prefix)
        .then(none_of("\n\r").many())
        .map(|(_prefix, chars)| chars.into_iter().collect())
}

/// Parse a multi-line comment.
pub fn block_comment<'a>(start: &'static str, end: &'static str) -> impl Parser<'a, String> {
    struct BlockComment {
        start: &'static str,
        end: &'static str,
    }

    impl<'a> Parser<'a, String> for BlockComment {
        fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, String> {
            if !input[pos..].starts_with(self.start) {
                return Err(ParseError::new(
                    Span::new(pos, pos),
                    ErrorKind::ExpectedString(self.start),
                    input,
                ));
            }

            let mut current_pos = pos + self.start.len();
            let mut depth = 1;

            while depth > 0 && current_pos < input.len() {
                if input[current_pos..].starts_with(self.start) {
                    depth += 1;
                    current_pos += self.start.len();
                } else if input[current_pos..].starts_with(self.end) {
                    depth -= 1;
                    current_pos += self.end.len();
                } else {
                    current_pos += input[current_pos..].chars().next().unwrap().len_utf8();
                }
            }

            if depth == 0 {
                let content = &input[pos + self.start.len()..current_pos - self.end.len()];
                Ok((content.to_string(), current_pos))
            } else {
                Err(ParseError::new(
                    Span::new(pos, input.len()),
                    ErrorKind::Custom("unclosed block comment".to_string()),
                    input,
                ))
            }
        }
    }

    BlockComment { start, end }
}

// ============================================================================
// Whitespace with comments
// ============================================================================

/// A whitespace parser that also skips comments.
pub fn ws_with_comments<'a>(
    line_comment_prefix: &'static str,
    block_start: &'static str,
    block_end: &'static str,
) -> impl Parser<'a, ()> {
    struct WsWithComments {
        line_prefix: &'static str,
        block_start: &'static str,
        block_end: &'static str,
    }

    impl<'a> Parser<'a, ()> for WsWithComments {
        fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, ()> {
            let mut current_pos = pos;
            loop {
                if let Ok((_, new_pos)) = whitespace().parse(input, current_pos) {
                    if new_pos == current_pos {
                        break;
                    }
                    current_pos = new_pos;
                    continue;
                }
                if let Ok((_, new_pos)) = line_comment(self.line_prefix).parse(input, current_pos) {
                    current_pos = new_pos;
                    continue;
                }
                if let Ok((_, new_pos)) =
                    block_comment(self.block_start, self.block_end).parse(input, current_pos)
                {
                    current_pos = new_pos;
                    continue;
                }
                break;
            }
            Ok(((), current_pos))
        }
    }

    struct WsWithCommentsSkipMany<W> {
        inner: W,
    }

    impl<'a, W> Parser<'a, ()> for WsWithCommentsSkipMany<W>
    where
        W: Parser<'a, ()>,
    {
        fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, ()> {
            let mut current_pos = pos;
            loop {
                match self.inner.parse(input, current_pos) {
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

    WsWithCommentsSkipMany {
        inner: WsWithComments {
            line_prefix: line_comment_prefix,
            block_start,
            block_end,
        },
    }
}

/// Standard whitespace skippers for C-style languages.
pub fn ws_c_style<'a>() -> impl Parser<'a, ()> {
    ws_with_comments("//", "/*", "*/")
}

// ============================================================================
// Delimiting helpers
// ============================================================================

/// Wrap a parser with whitespace handling on both sides.
pub fn surrounded_by_ws<'a, T, P>(parser: P) -> impl Parser<'a, T>
where
    P: Parser<'a, T> + 'a,
{
    multispace0().ignore_then(parser).then_ignore(multispace0())
}

/// Parse a delimited expression.
pub fn delimited<'a, T, L, R, LeftOut, RightOut>(
    left: L,
    parser: impl Parser<'a, T> + 'a,
    right: R,
) -> impl Parser<'a, T> + 'a
where
    L: Parser<'a, LeftOut> + 'a,
    R: Parser<'a, RightOut> + 'a,
    T: 'a,
    LeftOut: 'a,
    RightOut: 'a,
{
    struct Delimited<L, R, P, LeftOut, RightOut> {
        left: L,
        parser: P,
        right: R,
        _marker: PhantomData<fn() -> (LeftOut, RightOut)>,
    }

    impl<'a, L, R, P, T, LeftOut, RightOut> Parser<'a, T>
        for Delimited<L, R, P, LeftOut, RightOut>
    where
        L: Parser<'a, LeftOut>,
        R: Parser<'a, RightOut>,
        P: Parser<'a, T>,
        LeftOut: 'a,
        RightOut: 'a,
    {
        fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
            let (_, pos) = self.left.parse(input, pos)?;
            let (val, pos) = self.parser.parse(input, pos)?;
            let (_, pos) = self.right.parse(input, pos)?;
            Ok((val, pos))
        }
    }

    Delimited {
        left,
        parser,
        right,
        _marker: PhantomData,
    }
}

/// Parse parenthesized expression.
pub fn parens<'a, T>(parser: impl Parser<'a, T> + 'a) -> impl Parser<'a, T> + 'a
where
    T: 'a,
{
    delimited(char('('), parser, char(')'))
}

/// Parse bracketed expression.
pub fn brackets<'a, T>(parser: impl Parser<'a, T> + 'a) -> impl Parser<'a, T> + 'a
where
    T: 'a,
{
    delimited(char('['), parser, char(']'))
}

/// Parse braced expression.
pub fn braces<'a, T>(parser: impl Parser<'a, T> + 'a) -> impl Parser<'a, T> + 'a
where
    T: 'a,
{
    delimited(char('{'), parser, char('}'))
}

// ============================================================================
// Recursive parser helper
// ============================================================================

/// Helper to create recursive parsers.
pub struct Recursive<'a, T, F>
where
    F: Fn() -> BoxParser<'a, T>,
{
    f: F,
}

impl<'a, T, F> Parser<'a, T> for Recursive<'a, T, F>
where
    F: Fn() -> BoxParser<'a, T>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, T> {
        (self.f)().parse(input, pos)
    }
}

/// Create a recursive parser.
///
/// # Example
/// ```ignore
/// let expr = recursive(|| {
///     let atom = int::<i32>().or(parens(expr()));
///     Box::new(atom) as BoxParser<i32>
/// });
/// ```
pub fn recursive<'a, T, F>(f: F) -> Recursive<'a, T, F>
where
    F: Fn() -> BoxParser<'a, T>,
{
    Recursive { f }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Parser;

    #[test]
    fn test_choice_boxed() {
        let parser = choice_boxed([
            Box::new(char('a')) as BoxParser<char>,
            Box::new(char('b')) as BoxParser<char>,
            Box::new(char('c')) as BoxParser<char>,
        ]);
        assert_eq!(parser.parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(parser.parse("b", 0).unwrap(), ('b', 1));
        assert_eq!(parser.parse("c", 0).unwrap(), ('c', 1));
        assert!(parser.parse("d", 0).is_err());
    }

    #[test]
    fn test_digit() {
        assert_eq!(digit().parse("5", 0).unwrap(), ('5', 1));
        assert!(digit().parse("a", 0).is_err());
    }

    #[test]
    fn test_alpha() {
        assert_eq!(alpha().parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(alpha().parse("Z", 0).unwrap(), ('Z', 1));
        assert!(alpha().parse("5", 0).is_err());
    }

    #[test]
    fn test_alphanum() {
        assert_eq!(alphanum().parse("a", 0).unwrap(), ('a', 1));
        assert_eq!(alphanum().parse("5", 0).unwrap(), ('5', 1));
        assert!(alphanum().parse("_", 0).is_err());
    }

    #[test]
    fn test_ident() {
        assert_eq!(ident().parse("hello", 0).unwrap(), ("hello".to_string(), 5));
        assert_eq!(
            ident().parse("_world123", 0).unwrap(),
            ("_world123".to_string(), 9)
        );
        assert_eq!(
            ident().parse("a1_b2", 0).unwrap(),
            ("a1_b2".to_string(), 5)
        );
        assert!(ident().parse("123abc", 0).is_err());
    }

    #[test]
    fn test_int() {
        let parser = int::<i32>();
        assert_eq!(parser.parse("123", 0).unwrap(), (123, 3));
        assert_eq!(parser.parse("42", 0).unwrap(), (42, 2));
    }

    #[test]
    fn test_number() {
        let parser = number::<f64>();
        assert_eq!(parser.parse("123", 0).unwrap(), (123.0, 3));
        assert_eq!(parser.parse("123.456", 0).unwrap(), (123.456, 7));
        assert_eq!(parser.parse("1e10", 0).unwrap(), (1e10, 4));
        assert_eq!(parser.parse("1.5e-3", 0).unwrap(), (0.0015, 6));
    }

    #[test]
    fn test_quoted_string() {
        assert_eq!(
            quoted_string().parse(r#""hello world""#, 0).unwrap(),
            ("hello world".to_string(), 13)
        );
        assert_eq!(
            quoted_string().parse(r#""hello\nworld""#, 0).unwrap(),
            ("hello\nworld".to_string(), 14)
        );
        assert_eq!(
            quoted_string().parse(r#""escaped\"quote""#, 0).unwrap(),
            ("escaped\"quote".to_string(), 15)
        );
    }

    #[test]
    fn test_line_comment() {
        assert_eq!(
            line_comment("//").parse("// this is a comment\n", 0).unwrap(),
            (" this is a comment".to_string(), 21)
        );
    }

    #[test]
    fn test_block_comment() {
        assert_eq!(
            block_comment("/*", "*/").parse("/* comment */", 0).unwrap(),
            (" comment ".to_string(), 12)
        );
    }

    #[test]
    fn test_parens() {
        assert_eq!(parens(int::<i32>()).parse("(42)", 0).unwrap(), (42, 4));
    }

    #[test]
    fn test_brackets() {
        assert_eq!(
            brackets(int::<i32>()).parse("[42]", 0).unwrap(),
            (42, 4)
        );
    }

    #[test]
    fn test_braces() {
        assert_eq!(braces(int::<i32>()).parse("{42}", 0).unwrap(), (42, 4));
    }

    #[test]
    fn test_sep_by() {
        let parser = int::<i32>().sep_by(char(','));
        assert_eq!(
            parser.parse("1,2,3,4", 0).unwrap(),
            (vec![1, 2, 3, 4], 7)
        );
        assert_eq!(parser.parse("", 0).unwrap(), (Vec::<i32>::new(), 0));
    }

    #[test]
    fn test_sep_by1() {
        let parser = int::<i32>().sep_by1(char(','));
        assert_eq!(
            parser.parse("1,2,3", 0).unwrap(),
            (vec![1, 2, 3], 5)
        );
        assert!(parser.parse("", 0).is_err());
    }

    #[test]
    fn test_multispace0() {
        assert_eq!(multispace0().parse("   ", 0).unwrap(), ((), 3));
        assert_eq!(multispace0().parse("", 0).unwrap(), ((), 0));
        assert_eq!(multispace0().parse("abc", 0).unwrap(), ((), 0));
    }

    #[test]
    fn test_multispace1() {
        assert_eq!(multispace1().parse("   ", 0).unwrap(), ((), 3));
        assert!(multispace1().parse("", 0).is_err());
        assert!(multispace1().parse("abc", 0).is_err());
    }
}

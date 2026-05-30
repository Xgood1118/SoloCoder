//! A type-safe parser combinator library inspired by Parsec, nom, and chumsky.
//!
//! This library provides a flexible framework for building parsers by combining
//! smaller parser primitives. It focuses on structured text parsing such as
//! configuration files, DSL statements, and simple expressions.

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs, clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

extern crate alloc;

pub mod errors;
pub mod primitives;
pub mod combinators;
pub mod expr;

use alloc::string::String;
use core::fmt;
use core::marker::PhantomData;

pub use errors::{ParseError, ParseResult, Span};
pub use primitives::*;
pub use combinators::*;

/// The core `Parser` trait that all parsers implement.
///
/// A parser takes an input string and a starting position, and returns either
/// a successful parse result with the output and new position, or a parse error.
pub trait Parser<'a, Output> {
    /// Parse the input starting at the given position.
    ///
    /// # Arguments
    /// * `input` - The full input string
    /// * `pos` - The current byte position in the input
    ///
    /// # Returns
    /// A `ParseResult` containing either the parsed output and new position, or an error.
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Output>;

    /// Map the output of this parser to a new value.
    fn map<F, T>(self, f: F) -> Map<Self, F, Output>
    where
        Self: Sized,
        F: Fn(Output) -> T,
    {
        Map {
            parser: self,
            f,
            _marker: PhantomData,
        }
    }

    /// Map the output of this parser to a new value that can fail.
    fn map_res<F, T, E>(self, f: F) -> MapRes<Self, F, Output, E>
    where
        Self: Sized,
        F: Fn(Output) -> Result<T, E>,
        E: fmt::Display,
    {
        MapRes {
            parser: self,
            f,
            _marker: PhantomData,
        }
    }

    /// Sequence this parser with another parser.
    fn and_then<F, P, T>(self, f: F) -> AndThen<Self, F, Output>
    where
        Self: Sized,
        F: Fn(Output) -> P,
        P: Parser<'a, T>,
    {
        AndThen {
            parser: self,
            f,
            _marker: PhantomData,
        }
    }

    /// Sequence this parser with another parser, keeping both outputs.
    fn then<P, T>(self, other: P) -> Then<Self, P>
    where
        Self: Sized,
        P: Parser<'a, T>,
    {
        Then {
            first: self,
            second: other,
        }
    }

    /// Sequence this parser with another parser, ignoring the second output.
    fn then_ignore<P, T>(self, other: P) -> ThenIgnore<Self, P, T>
    where
        Self: Sized,
        P: Parser<'a, T>,
    {
        ThenIgnore {
            first: self,
            second: other,
            _marker: PhantomData,
        }
    }

    /// Sequence this parser with another parser, ignoring the first output.
    fn ignore_then<P, T>(self, other: P) -> IgnoreThen<Self, P, Output>
    where
        Self: Sized,
        P: Parser<'a, T>,
    {
        IgnoreThen {
            first: self,
            second: other,
            _marker: PhantomData,
        }
    }

    /// Try this parser, and if it fails, try another parser.
    fn or<P>(self, other: P) -> Or<Self, P>
    where
        Self: Sized,
        P: Parser<'a, Output>,
    {
        Or {
            first: self,
            second: other,
        }
    }

    /// Wrap this parser to allow backtracking.
    fn r#try(self) -> Try<Self>
    where
        Self: Sized,
    {
        Try { parser: self }
    }

    /// Mark this parser as a cut point - if it fails, don't try alternatives.
    fn cut(self) -> Cut<Self>
    where
        Self: Sized,
    {
        Cut { parser: self }
    }

    /// Parse this parser, but don't consume input.
    fn look_ahead(self) -> LookAhead<Self>
    where
        Self: Sized,
    {
        LookAhead { parser: self }
    }

    /// Make this parser optional.
    fn optional(self) -> Optional<Self>
    where
        Self: Sized,
    {
        Optional { parser: self }
    }

    /// Repeat this parser zero or more times.
    fn many(self) -> Many<Self>
    where
        Self: Sized,
    {
        Many { parser: self }
    }

    /// Repeat this parser one or more times.
    fn many1(self) -> Many1<Self>
    where
        Self: Sized,
    {
        Many1 { parser: self }
    }

    /// Repeat this parser zero or more times, separated by a separator.
    fn sep_by<S, SepOut>(self, separator: S) -> SepBy<Self, S, SepOut>
    where
        Self: Sized,
        S: Parser<'a, SepOut>,
    {
        SepBy {
            parser: self,
            separator,
            allow_trailing: false,
            _marker: PhantomData,
        }
    }

    /// Repeat this parser zero or more times, separated by a separator, allowing trailing separator.
    fn sep_by_allow_trailing<S, SepOut>(self, separator: S) -> SepBy<Self, S, SepOut>
    where
        Self: Sized,
        S: Parser<'a, SepOut>,
    {
        SepBy {
            parser: self,
            separator,
            allow_trailing: true,
            _marker: PhantomData,
        }
    }

    /// Repeat this parser one or more times, separated by a separator.
    fn sep_by1<S, SepOut>(self, separator: S) -> SepBy1<Self, S, SepOut>
    where
        Self: Sized,
        S: Parser<'a, SepOut>,
    {
        SepBy1 {
            parser: self,
            separator,
            allow_trailing: false,
            _marker: PhantomData,
        }
    }

    /// Skip this parser zero or more times.
    fn skip_many(self) -> SkipMany<Self, Output>
    where
        Self: Sized,
    {
        SkipMany {
            parser: self,
            _marker: PhantomData,
        }
    }

    /// Skip this parser one or more times.
    fn skip_many1(self) -> SkipMany1<Self, Output>
    where
        Self: Sized,
    {
        SkipMany1 {
            parser: self,
            _marker: PhantomData,
        }
    }

    /// Parse the complete input, ensuring all input is consumed.
    fn complete(self) -> Complete<Self>
    where
        Self: Sized,
    {
        Complete { parser: self }
    }

    /// Convenience method to parse an entire string.
    fn parse_str(&self, input: &'a str) -> Result<Output, ParseError<'a>> {
        match self.parse(input, 0) {
            Ok((output, _)) => Ok(output),
            Err(e) => Err(e),
        }
    }
}

impl<'a, Output, F> Parser<'a, Output> for F
where
    F: Fn(&'a str, usize) -> ParseResult<'a, Output>,
{
    fn parse(&self, input: &'a str, pos: usize) -> ParseResult<'a, Output> {
        self(input, pos)
    }
}

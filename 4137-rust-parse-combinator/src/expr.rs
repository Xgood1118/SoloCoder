//! Expression parsing using Pratt parsing algorithm.
//!
//! This module provides utilities for parsing expressions with operator
//! precedence and associativity.

use crate::combinators::BoxParser;
use crate::Parser;
use alloc::boxed::Box;
use alloc::vec::Vec;

/// Operator associativity.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Assoc {
    /// Left-associative (e.g., addition: a + b + c = (a + b) + c)
    Left,
    /// Right-associative (e.g., exponentiation: a ^ b ^ c = a ^ (b ^ c))
    Right,
}

/// An infix operator with precedence and associativity.
pub struct InfixOp<'a, T> {
    /// Precedence level (higher = binds tighter)
    pub precedence: u32,
    /// Associativity
    pub assoc: Assoc,
    /// Parser for the operator symbol
    pub parser: BoxParser<'a, ()>,
    /// Function to combine left and right values
    pub apply: Box<dyn Fn(T, T) -> T + 'a>,
}

/// A prefix operator with precedence.
pub struct PrefixOp<'a, T> {
    /// Precedence level
    pub precedence: u32,
    /// Parser for the operator symbol
    pub parser: BoxParser<'a, ()>,
    /// Function to apply the operator
    pub apply: Box<dyn Fn(T) -> T + 'a>,
}

/// A postfix operator with precedence.
pub struct PostfixOp<'a, T> {
    /// Precedence level
    pub precedence: u32,
    /// Parser for the operator symbol
    pub parser: BoxParser<'a, ()>,
    /// Function to apply the operator
    pub apply: Box<dyn Fn(T) -> T + 'a>,
}

/// Builder for expression parsers.
pub struct ExprParser<'a, T> {
    prefix_ops: Vec<PrefixOp<'a, T>>,
    infix_ops: Vec<InfixOp<'a, T>>,
    postfix_ops: Vec<PostfixOp<'a, T>>,
}

impl<'a, T> Default for ExprParser<'a, T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<'a, T> ExprParser<'a, T> {
    /// Create a new expression parser builder.
    pub fn new() -> Self {
        Self {
            prefix_ops: Vec::new(),
            infix_ops: Vec::new(),
            postfix_ops: Vec::new(),
        }
    }

    /// Add a prefix operator.
    pub fn prefix<P, F>(mut self, precedence: u32, parser: P, apply: F) -> Self
    where
        P: Parser<'a, ()> + 'a,
        F: Fn(T) -> T + 'a,
    {
        self.prefix_ops.push(PrefixOp {
            precedence,
            parser: Box::new(parser),
            apply: Box::new(apply),
        });
        self
    }

    /// Add an infix operator.
    pub fn infix<P, F>(mut self, precedence: u32, assoc: Assoc, parser: P, apply: F) -> Self
    where
        P: Parser<'a, ()> + 'a,
        F: Fn(T, T) -> T + 'a,
    {
        self.infix_ops.push(InfixOp {
            precedence,
            assoc,
            parser: Box::new(parser),
            apply: Box::new(apply),
        });
        self
    }

    /// Add a postfix operator.
    pub fn postfix<P, F>(mut self, precedence: u32, parser: P, apply: F) -> Self
    where
        P: Parser<'a, ()> + 'a,
        F: Fn(T) -> T + 'a,
    {
        self.postfix_ops.push(PostfixOp {
            precedence,
            parser: Box::new(parser),
            apply: Box::new(apply),
        });
        self
    }

    /// Build the expression parser.
    pub fn build<A>(self, atom: A) -> impl Parser<'a, T> + 'a
    where
        A: Parser<'a, T> + 'a,
        T: Clone + 'a,
    {
        struct ExprParserImpl<'a, T, A> {
            parser: ExprParser<'a, T>,
            atom: A,
        }

        impl<'a, T, A> Parser<'a, T> for ExprParserImpl<'a, T, A>
        where
            A: Parser<'a, T>,
            T: Clone,
        {
            fn parse(
                &self,
                input: &'a str,
                pos: usize,
            ) -> crate::errors::ParseResult<'a, T> {
                self.parser.parse_expr(input, pos, &self.atom, 0)
            }
        }

        ExprParserImpl { parser: self, atom }
    }

    fn parse_expr<A>(
        &self,
        input: &'a str,
        pos: usize,
        atom: &A,
        min_precedence: u32,
    ) -> crate::errors::ParseResult<'a, T>
    where
        A: Parser<'a, T>,
        T: Clone,
    {
        let (mut left, mut pos) = self.parse_prefix(input, pos, atom)?;

        loop {
            let mut found = false;

            for op in &self.infix_ops {
                if op.precedence < min_precedence {
                    continue;
                }

                if let Ok(((), new_pos)) = op.parser.parse(input, pos) {
                    let next_min = if op.assoc == Assoc::Left {
                        op.precedence + 1
                    } else {
                        op.precedence
                    };

                    let (right, right_pos) = self.parse_expr(input, new_pos, atom, next_min)?;
                    left = (op.apply)(left, right);
                    pos = right_pos;
                    found = true;
                    break;
                }
            }

            if !found {
                for op in &self.postfix_ops {
                    if op.precedence < min_precedence {
                        continue;
                    }

                    if let Ok(((), new_pos)) = op.parser.parse(input, pos) {
                        left = (op.apply)(left);
                        pos = new_pos;
                        found = true;
                        break;
                    }
                }
            }

            if !found {
                break;
            }
        }

        Ok((left, pos))
    }

    fn parse_prefix<A>(
        &self,
        input: &'a str,
        pos: usize,
        atom: &A,
    ) -> crate::errors::ParseResult<'a, T>
    where
        A: Parser<'a, T>,
        T: Clone,
    {
        for op in &self.prefix_ops {
            if let Ok(((), new_pos)) = op.parser.parse(input, pos) {
                let (right, right_pos) = self.parse_expr(input, new_pos, atom, op.precedence)?;
                return Ok(((op.apply)(right), right_pos));
            }
        }

        atom.parse(input, pos)
    }
}

/// Helper to create a simple arithmetic expression parser.
///
/// # Example
/// ```ignore
/// let parser = arithmetic_expr(
///     int::<i32>(),
///     |a, b| a + b,
///     |a, b| a - b,
///     |a, b| a * b,
///     |a, b| a / b,
///     |a| -a,
/// );
/// ```
pub fn arithmetic_expr<'a, T, A, Add, Sub, Mul, Div, Neg>(
    atom: A,
    add: Add,
    sub: Sub,
    mul: Mul,
    div: Div,
    neg: Neg,
) -> impl Parser<'a, T> + 'a
where
    A: Parser<'a, T> + 'a,
    Add: Fn(T, T) -> T + 'a,
    Sub: Fn(T, T) -> T + 'a,
    Mul: Fn(T, T) -> T + 'a,
    Div: Fn(T, T) -> T + 'a,
    Neg: Fn(T) -> T + 'a,
    T: Clone + 'a,
{
    use crate::primitives::char;

    ExprParser::new()
        .prefix(100, char('-').map(|_| ()), neg)
        .infix(10, Assoc::Left, char('+').map(|_| ()), add)
        .infix(10, Assoc::Left, char('-').map(|_| ()), sub)
        .infix(20, Assoc::Left, char('*').map(|_| ()), mul)
        .infix(20, Assoc::Left, char('/').map(|_| ()), div)
        .build(atom)
}

/// Helper to create a logical expression parser.
pub fn logical_expr<'a, T, A, And, Or, Not>(
    atom: A,
    and: And,
    or: Or,
    not: Not,
) -> impl Parser<'a, T> + 'a
where
    A: Parser<'a, T> + 'a,
    And: Fn(T, T) -> T + Clone + 'a,
    Or: Fn(T, T) -> T + Clone + 'a,
    Not: Fn(T) -> T + Clone + 'a,
    T: Clone + 'a,
{
    use crate::combinators::keyword;
    use crate::primitives::char;

    ExprParser::new()
        .prefix(50, keyword("not").map(|_| ()), not.clone())
        .prefix(50, char('!').map(|_| ()), not)
        .infix(30, Assoc::Left, keyword("and").map(|_| ()), and.clone())
        .infix(30, Assoc::Left, char('&').then(char('&')).map(|_| ()), and)
        .infix(20, Assoc::Left, keyword("or").map(|_| ()), or.clone())
        .infix(20, Assoc::Left, char('|').then(char('|')).map(|_| ()), or)
        .build(atom)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::combinators::{int, parens, BoxParser};
    use crate::combinators::recursive;
    use crate::primitives::char;
    use crate::Parser;

    #[test]
    fn test_simple_arithmetic() {
        let atom = int::<i32>().or(parens(recursive(|| {
            Box::new(arithmetic_expr(
                int::<i32>(),
                |a, b| a + b,
                |a, b| a - b,
                |a, b| a * b,
                |a, b| a / b,
                |a| -a,
            )) as BoxParser<i32>
        })));

        let parser = arithmetic_expr(
            atom,
            |a, b| a + b,
            |a, b| a - b,
            |a, b| a * b,
            |a, b| a / b,
            |a| -a,
        );

        assert_eq!(parser.parse("1 + 2", 0).unwrap(), (3, 5));
        assert_eq!(parser.parse("1 + 2 * 3", 0).unwrap(), (7, 9));
        assert_eq!(parser.parse("(1 + 2) * 3", 0).unwrap(), (9, 9));
        assert_eq!(parser.parse("-5 + 3", 0).unwrap(), (-2, 5));
        assert_eq!(parser.parse("10 - 3 - 2", 0).unwrap(), (5, 9));
    }

    #[test]
    fn test_prefix_operators() {
        let atom = int::<i32>();
        let parser = ExprParser::new()
            .prefix(100, char('-').map(|_| ()), |a: i32| -a)
            .prefix(100, char('+').map(|_| ()), |a: i32| a)
            .build(atom);

        assert_eq!(parser.parse("-5", 0).unwrap(), (-5, 2));
        assert_eq!(parser.parse("+5", 0).unwrap(), (5, 2));
        assert_eq!(parser.parse("--5", 0).unwrap(), (5, 3));
    }

    #[test]
    fn test_right_associativity() {
        let atom = int::<i32>();
        let parser = ExprParser::new()
            .infix(20, Assoc::Right, char('^').map(|_| ()), |a: i32, b: i32| {
                a.pow(b as u32)
            })
            .build(atom);

        assert_eq!(parser.parse("2 ^ 3", 0).unwrap(), (8, 5));
        assert_eq!(parser.parse("2 ^ 3 ^ 2", 0).unwrap(), (512, 9));
    }

    #[test]
    fn test_postfix_operators() {
        let atom = int::<i32>();
        let parser = ExprParser::new()
            .postfix(50, char('!').map(|_| ()), |a: i32| {
                (1..=a).product()
            })
            .build(atom);

        assert_eq!(parser.parse("5!", 0).unwrap(), (120, 2));
        assert_eq!(parser.parse("3!", 0).unwrap(), (6, 2));
    }
}

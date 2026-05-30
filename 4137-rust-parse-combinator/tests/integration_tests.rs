//! Integration tests for the parse_combinator library.

use parse_combinator::combinators::*;
use parse_combinator::expr::*;
use parse_combinator::Parser;

#[test]
fn test_simple_expression() {
    let parser = char('a').then(char('b')).then(char('c'));
    let result = parser.parse("abc", 0);
    assert!(result.is_ok());
    let (((a, b), c), pos) = result.unwrap();
    assert_eq!(a, 'a');
    assert_eq!(b, 'b');
    assert_eq!(c, 'c');
    assert_eq!(pos, 3);
}

#[test]
fn test_chain_calls() {
    let parser = alpha()
        .then_ignore(whitespace().skip_many())
        .then(digit().many1());

    let result = parser.parse("hello 123", 0);
    assert!(result.is_ok());
}

#[test]
fn test_math_expression() {
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

    assert_eq!(parser.parse_str("2 + 3 * 4").unwrap(), 14);
    assert_eq!(parser.parse_str("(2 + 3) * 4").unwrap(), 20);
    assert_eq!(parser.parse_str("-10 + 5").unwrap(), -5);
}

#[test]
fn test_list_parsing() {
    let parser = int::<i32>().sep_by(char(','));
    assert_eq!(parser.parse_str("1,2,3,4").unwrap(), vec![1, 2, 3, 4]);
    assert_eq!(parser.parse_str("").unwrap(), Vec::<i32>::new());
}

#[test]
fn test_identifier_parsing() {
    assert_eq!(ident().parse_str("my_var123").unwrap(), "my_var123");
    assert_eq!(ident().parse_str("_private").unwrap(), "_private");
    assert!(ident().parse_str("123invalid").is_err());
}

#[test]
fn test_string_with_escapes() {
    assert_eq!(
        quoted_string().parse_str(r#""hello\nworld""#).unwrap(),
        "hello\nworld"
    );
    assert_eq!(
        quoted_string().parse_str(r#""tab\tcharacter""#).unwrap(),
        "tab\tcharacter"
    );
}

#[test]
fn test_error_position() {
    let parser = char('a').then(char('b')).then(char('c'));
    let err = parser.parse_str("axc").unwrap_err();
    let (line, col, _, _) = err.span.line_col("axc");
    assert_eq!(line, 1);
    assert_eq!(col, 2);
}

#[test]
fn test_choice_backtracking() {
    let parser = choice_boxed([
        Box::new(string("hello").then(char('!'))) as BoxParser<(&str, char)>,
        Box::new(string("hello").then(char('?'))) as BoxParser<(&str, char)>,
        Box::new(string("hello").map(|s| (s, ' '))) as BoxParser<(&str, char)>,
    ]);

    assert!(parser.parse_str("hello!").is_ok());
    assert!(parser.parse_str("hello?").is_ok());
}

#[test]
fn test_optional_parser() {
    let parser = char('a').optional().then(char('b'));
    assert_eq!(parser.parse_str("ab").unwrap(), (Some('a'), 'b'));
    assert_eq!(parser.parse_str("b").unwrap(), (None, 'b'));
}

#[test]
fn test_many_zero() {
    let parser = char('a').many();
    assert_eq!(parser.parse_str("").unwrap(), Vec::<char>::new());
    assert_eq!(parser.parse_str("b").unwrap(), Vec::<char>::new());
}

#[test]
fn test_complete_parser() {
    let parser = int::<i32>().complete();
    assert!(parser.parse_str("42").is_ok());
    assert!(parser.parse_str("42abc").is_err());
}

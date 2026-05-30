//! Example: A simple JSON parser using the parse_combinator library.

use parse_combinator::combinators::*;
use parse_combinator::expr::*;
use parse_combinator::*;
use std::string::String;
use std::vec::Vec;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
enum JsonValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

fn json_null<'a>() -> impl Parser<'a, JsonValue> {
    string("null").map(|_| JsonValue::Null)
}

fn json_bool<'a>() -> impl Parser<'a, JsonValue> {
    string("true")
        .map(|_| JsonValue::Bool(true))
        .or(string("false").map(|_| JsonValue::Bool(false)))
}

fn json_number<'a>() -> impl Parser<'a, JsonValue> {
    number::<f64>().map(JsonValue::Number)
}

fn json_string<'a>() -> impl Parser<'a, JsonValue> {
    quoted_string().map(JsonValue::String)
}

fn ws<'a>() -> impl Parser<'a, ()> {
    multispace0()
}

fn json_array<'a>() -> impl Parser<'a, JsonValue> {
    let element = ws().ignore_then(json_value()).then_ignore(ws());
    let elements = element.sep_by_allow_trailing(char(','));

    brackets(ws().ignore_then(elements).then_ignore(ws()))
        .map(JsonValue::Array)
}

fn json_object<'a>() -> impl Parser<'a, JsonValue> {
    let key = ws().ignore_then(quoted_string()).then_ignore(ws());
    let colon = char(':').then_ignore(ws());
    let value = json_value().then_ignore(ws());

    let pair = key.then_ignore(colon).then(value);
    let pairs = pair.sep_by_allow_trailing(char(','));

    braces(ws().ignore_then(pairs).then_ignore(ws()))
        .map(|pairs| {
            let mut map = BTreeMap::new();
            for (k, v) in pairs {
                map.insert(k, v);
            }
            JsonValue::Object(map)
        })
}

fn json_value<'a>() -> impl Parser<'a, JsonValue> {
    recursive(|| {
        Box::new(choice_boxed([
            Box::new(json_null()) as BoxParser<JsonValue>,
            Box::new(json_bool()) as BoxParser<JsonValue>,
            Box::new(json_number()) as BoxParser<JsonValue>,
            Box::new(json_string()) as BoxParser<JsonValue>,
            Box::new(json_array()) as BoxParser<JsonValue>,
            Box::new(json_object()) as BoxParser<JsonValue>,
        ])) as BoxParser<JsonValue>
    })
}

fn main() {
    let input = r#"
    {
        "name": "John Doe",
        "age": 30,
        "is_student": false,
        "scores": [95.5, 87.3, 92.1],
        "address": {
            "city": "New York",
            "zip": "10001"
        },
        "null_value": null
    }
    "#;

    let parser = ws().ignore_then(json_value()).then_ignore(ws()).complete();

    match parser.parse_str(input) {
        Ok(value) => {
            println!("Parsed JSON:");
            println!("{:#?}", value);
        }
        Err(e) => {
            println!("Parse error: {}", e);
        }
    }
}

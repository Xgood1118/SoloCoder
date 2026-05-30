use parse_combinator::combinators::*;
use parse_combinator::Parser;

fn bench_char(b: &mut criterion::Bencher) {
    let parser = char('a');
    b.iter(|| parser.parse_str("a"));
}

fn bench_many(b: &mut criterion::Bencher) {
    let parser = char('a').many();
    b.iter(|| parser.parse_str("aaaaa"));
}

fn bench_int(b: &mut criterion::Bencher) {
    let parser = int::<i32>();
    b.iter(|| parser.parse_str("12345"));
}

fn bench_ident(b: &mut criterion::Bencher) {
    let parser = ident();
    b.iter(|| parser.parse_str("hello_world"));
}

criterion::criterion_group!(benches, bench_char, bench_many, bench_int, bench_ident);
criterion::criterion_main!(benches);
import {
  TermQuery,
  PhraseQuery,
  BooleanQuery,
  FuzzyQuery,
  RangeQuery,
  MultiFieldQuery,
  MatchAllQuery,
  WildcardQuery,
  Query,
  QueryType,
} from '../core/types';

enum TokenType {
  WORD = 'WORD',
  QUOTED_STRING = 'QUOTED_STRING',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  COLON = 'COLON',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  TILDE = 'TILDE',
  NUMBER = 'NUMBER',
  TO = 'TO',
  EOF = 'EOF',
}

interface Token {
  type: TokenType;
  value: string;
}

class QueryLexer {
  private input: string;
  private pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      if (ch === '"') {
        tokens.push(this.readQuotedString());
      } else if (ch === '+') {
        tokens.push({ type: TokenType.PLUS, value: '+' });
        this.pos++;
      } else if (ch === '-') {
        tokens.push({ type: TokenType.MINUS, value: '-' });
        this.pos++;
      } else if (ch === ':') {
        tokens.push({ type: TokenType.COLON, value: ':' });
        this.pos++;
      } else if (ch === '(') {
        tokens.push({ type: TokenType.LPAREN, value: '(' });
        this.pos++;
      } else if (ch === ')') {
        tokens.push({ type: TokenType.RPAREN, value: ')' });
        this.pos++;
      } else if (ch === '[') {
        tokens.push({ type: TokenType.LBRACKET, value: '[' });
        this.pos++;
      } else if (ch === ']') {
        tokens.push({ type: TokenType.RBRACKET, value: ']' });
        this.pos++;
      } else if (ch === '{') {
        tokens.push({ type: TokenType.LBRACE, value: '{' });
        this.pos++;
      } else if (ch === '}') {
        tokens.push({ type: TokenType.RBRACE, value: '}' });
        this.pos++;
      } else if (ch === '~') {
        tokens.push({ type: TokenType.TILDE, value: '~' });
        this.pos++;
      } else {
        const word = this.readWord();
        if (word.length > 0) {
          const upper = word.toUpperCase();
          if (upper === 'AND') {
            tokens.push({ type: TokenType.AND, value: word });
          } else if (upper === 'OR') {
            tokens.push({ type: TokenType.OR, value: word });
          } else if (upper === 'NOT') {
            tokens.push({ type: TokenType.NOT, value: word });
          } else if (upper === 'TO') {
            tokens.push({ type: TokenType.TO, value: word });
          } else if (/^\d+(\.\d+)?$/.test(word)) {
            tokens.push({ type: TokenType.NUMBER, value: word });
          } else {
            tokens.push({ type: TokenType.WORD, value: word });
          }
        }
      }
    }
    tokens.push({ type: TokenType.EOF, value: '' });
    return tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private readQuotedString(): Token {
    this.pos++;
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.pos++;
        value += this.input[this.pos];
      } else {
        value += this.input[this.pos];
      }
      this.pos++;
    }
    if (this.pos < this.input.length) {
      this.pos++;
    }
    return { type: TokenType.QUOTED_STRING, value };
  }

  private readWord(): string {
    let word = '';
    while (
      this.pos < this.input.length &&
      !/[\s+\-:()\[\]{}~"\\]/.test(this.input[this.pos])
    ) {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.pos++;
        word += this.input[this.pos];
      } else {
        word += this.input[this.pos];
      }
      this.pos++;
    }
    return word;
  }
}

export class QueryParser {
  private defaultField: string;
  private defaultOperator: 'AND' | 'OR';
  private tokens: Token[];
  private pos: number;

  constructor(options?: { defaultField?: string; defaultOperator?: 'AND' | 'OR' }) {
    this.defaultField = options?.defaultField ?? '_all';
    this.defaultOperator = options?.defaultOperator ?? 'OR';
    this.tokens = [];
    this.pos = 0;
  }

  getDefaultField(): string {
    return this.defaultField;
  }

  parse(queryString: string): Query {
    if (!queryString || queryString.trim().length === 0) {
      return { type: QueryType.MATCH_ALL } as MatchAllQuery;
    }

    const truncated = queryString.length > 1000 ? queryString.substring(0, 1000) : queryString;

    const lexer = new QueryLexer(truncated);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    if (
      this.tokens.length === 1 &&
      this.tokens[0].type === TokenType.EOF
    ) {
      return { type: QueryType.MATCH_ALL } as MatchAllQuery;
    }

    const result = this.parseExpression();

    return result;
  }

  private peek(): Token {
    if (this.pos < this.tokens.length) {
      return this.tokens[this.pos];
    }
    return { type: TokenType.EOF, value: '' };
  }

  private advance(): Token {
    const token = this.peek();
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected token type ${type} but got ${token.type}`);
    }
    return token;
  }

  private parseExpression(): Query {
    let left = this.parseAndExpression();

    while (this.peek().type === TokenType.OR) {
      this.advance();
      const right = this.parseAndExpression();
      left = {
        type: QueryType.BOOLEAN,
        operator: 'OR',
        queries: [left, right],
      } as BooleanQuery;
    }

    return left;
  }

  private parseAndExpression(): Query {
    let left = this.parseFactor();

    while (
      this.peek().type === TokenType.AND ||
      this.isImplicitAnd()
    ) {
      if (this.peek().type === TokenType.AND) {
        this.advance();
      }
      const right = this.parseFactor();
      left = {
        type: QueryType.BOOLEAN,
        operator: 'AND',
        queries: [left, right],
      } as BooleanQuery;
    }

    return left;
  }

  private isImplicitAnd(): boolean {
    const next = this.peek();
    return (
      next.type === TokenType.WORD ||
      next.type === TokenType.QUOTED_STRING ||
      next.type === TokenType.PLUS ||
      next.type === TokenType.MINUS ||
      next.type === TokenType.LPAREN ||
      next.type === TokenType.LBRACKET ||
      next.type === TokenType.LBRACE ||
      next.type === TokenType.NUMBER
    );
  }

  private parseFactor(): Query {
    const token = this.peek();

    if (token.type === TokenType.PLUS) {
      this.advance();
      const query = this.parseAtom();
      return {
        type: QueryType.BOOLEAN,
        operator: 'AND',
        queries: [query],
        boost: 1.5,
      } as BooleanQuery;
    }

    if (token.type === TokenType.MINUS) {
      this.advance();
      const query = this.parseAtom();
      return {
        type: QueryType.BOOLEAN,
        operator: 'NOT',
        queries: [query],
      } as BooleanQuery;
    }

    if (token.type === TokenType.NOT) {
      this.advance();
      const query = this.parseFactor();
      return {
        type: QueryType.BOOLEAN,
        operator: 'NOT',
        queries: [query],
      } as BooleanQuery;
    }

    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    return this.parseAtom();
  }

  private parseAtom(): Query {
    const token = this.peek();

    if (token.type === TokenType.QUOTED_STRING) {
      this.advance();
      const terms = token.value.split(/\s+/).filter((t) => t.length > 0);
      if (terms.length === 0) {
        return { type: QueryType.MATCH_ALL } as MatchAllQuery;
      }
      if (terms.length === 1) {
        return {
          type: QueryType.TERM,
          field: this.defaultField,
          term: terms[0],
        } as TermQuery;
      }
      return {
        type: QueryType.PHRASE,
        field: this.defaultField,
        terms,
      } as PhraseQuery;
    }

    if (
      token.type === TokenType.WORD ||
      token.type === TokenType.NUMBER
    ) {
      return this.parseFieldOrTerm();
    }

    if (token.type === TokenType.LBRACKET || token.type === TokenType.LBRACE) {
      return this.parseRange(this.defaultField);
    }

    return {
      type: QueryType.TERM,
      field: this.defaultField,
      term: '',
    } as TermQuery;
  }

  private parseFieldOrTerm(): Query {
    const token = this.advance();
    const value = token.value;

    if (this.peek().type === TokenType.COLON) {
      this.advance();
      const field = value;

      const next = this.peek();

      if (next.type === TokenType.LBRACKET || next.type === TokenType.LBRACE) {
        return this.parseRange(field);
      }

      if (next.type === TokenType.QUOTED_STRING) {
        this.advance();
        const terms = next.value.split(/\s+/).filter((t) => t.length > 0);
        if (terms.length === 0) {
          return { type: QueryType.MATCH_ALL } as MatchAllQuery;
        }
        if (terms.length === 1) {
          return {
            type: QueryType.TERM,
            field,
            term: terms[0],
          } as TermQuery;
        }
        return {
          type: QueryType.PHRASE,
          field,
          terms,
        } as PhraseQuery;
      }

      if (next.type === TokenType.WORD || next.type === TokenType.NUMBER) {
        const termToken = this.advance();

        if (value === '*' && termToken.value === '*') {
          return { type: QueryType.MATCH_ALL } as MatchAllQuery;
        }

        return this.parseModifiers(field, termToken.value);
      }

      if (next.type === TokenType.LPAREN) {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return this.applyFieldToQuery(field, expr);
      }

      return {
        type: QueryType.TERM,
        field,
        term: '',
      } as TermQuery;
    }

    return this.parseModifiers(this.defaultField, value);
  }

  private parseModifiers(field: string, term: string): Query {
    if (this.peek().type === TokenType.TILDE) {
      this.advance();
      let maxEdits = 2;
      if (
        this.peek().type === TokenType.NUMBER ||
        this.peek().type === TokenType.WORD
      ) {
        const editToken = this.advance();
        const parsed = parseInt(editToken.value, 10);
        if (!isNaN(parsed)) {
          maxEdits = parsed;
        }
      }
      return {
        type: QueryType.FUZZY,
        field,
        term,
        maxEdits,
      } as FuzzyQuery;
    }

    if (term.includes('*') || term.includes('?')) {
      return {
        type: QueryType.WILDCARD,
        field,
        pattern: term,
      } as WildcardQuery;
    }

    return {
      type: QueryType.TERM,
      field,
      term,
    } as TermQuery;
  }

  private parseRange(field: string): Query {
    const openToken = this.advance();
    const inclusiveStart = openToken.type === TokenType.LBRACKET;

    let gt: string | undefined;
    let gte: string | undefined;

    const lowerToken = this.advance();
    if (lowerToken.type === TokenType.NUMBER || lowerToken.type === TokenType.WORD) {
      if (lowerToken.value === '*') {
        gt = undefined;
        gte = undefined;
      } else if (inclusiveStart) {
        gte = this.parseRangeValue(lowerToken.value);
      } else {
        gt = this.parseRangeValue(lowerToken.value);
      }
    }

    this.expect(TokenType.TO);

    const upperToken = this.advance();
    const closeToken = this.advance();

    let lt: string | undefined;
    let lte: string | undefined;
    const inclusiveEnd = closeToken.type === TokenType.RBRACKET;

    if (upperToken.type === TokenType.NUMBER || upperToken.type === TokenType.WORD) {
      if (upperToken.value === '*') {
        lt = undefined;
        lte = undefined;
      } else if (inclusiveEnd) {
        lte = this.parseRangeValue(upperToken.value);
      } else {
        lt = this.parseRangeValue(upperToken.value);
      }
    }

    return {
      type: QueryType.RANGE,
      field,
      gt,
      gte,
      lt,
      lte,
    } as RangeQuery;
  }

  private parseRangeValue(value: string): string {
    return value;
  }

  private applyFieldToQuery(field: string, query: Query): Query {
    switch (query.type) {
      case QueryType.TERM:
        return { ...query, field } as TermQuery;
      case QueryType.PHRASE:
        return { ...query, field } as PhraseQuery;
      case QueryType.FUZZY:
        return { ...query, field } as FuzzyQuery;
      case QueryType.WILDCARD:
        return { ...query, field } as WildcardQuery;
      case QueryType.BOOLEAN: {
        const boolQuery = query as BooleanQuery;
        return {
          ...boolQuery,
          queries: boolQuery.queries.map((q) => this.applyFieldToQuery(field, q)),
        } as BooleanQuery;
      }
      default:
        return query;
    }
  }
}

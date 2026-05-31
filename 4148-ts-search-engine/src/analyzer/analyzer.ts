import { Token } from '../core/types';
import {
  ITokenizer,
  ChineseTokenizer,
  EnglishTokenizer,
  MixedTokenizer,
} from './tokenizer';

export interface IAnalyzer {
  analyze(text: string, fieldName?: string): Token[];
}

export type TokenFilter = (tokens: Token[]) => Token[];

export class AnalyzerPipeline implements IAnalyzer {
  private tokenizer: ITokenizer;
  private preFilters: TokenFilter[];
  private postFilters: TokenFilter[];

  constructor(
    tokenizer: ITokenizer,
    preFilters?: TokenFilter[],
    postFilters?: TokenFilter[],
  ) {
    this.tokenizer = tokenizer;
    this.preFilters = preFilters ?? [];
    this.postFilters = postFilters ?? [];
  }

  analyze(text: string, _fieldName?: string): Token[] {
    let processedText = text;

    for (const filter of this.preFilters) {
      const tempTokens = filter([{ term: processedText, position: 0, startOffset: 0, endOffset: processedText.length }]);
      if (tempTokens.length === 1) {
        processedText = tempTokens[0].term;
      }
    }

    let result = this.tokenizer.tokenize(processedText);

    for (const filter of this.postFilters) {
      result = filter(result);
    }

    return result;
  }
}

export class AnalyzerRegistry {
  private analyzers: Map<string, IAnalyzer> = new Map();

  constructor() {
    this.register('chinese', createChineseAnalyzer());
    this.register('english', createEnglishAnalyzer());
    this.register('default', createDefaultAnalyzer());
  }

  register(name: string, analyzer: IAnalyzer): void {
    this.analyzers.set(name, analyzer);
  }

  get(name: string): IAnalyzer {
    const analyzer = this.analyzers.get(name);
    if (!analyzer) {
      throw new Error(`Analyzer '${name}' not found`);
    }
    return analyzer;
  }

  has(name: string): boolean {
    return this.analyzers.has(name);
  }
}

export function createChineseAnalyzer(
  preFilters?: TokenFilter[],
  postFilters?: TokenFilter[],
): IAnalyzer {
  return new AnalyzerPipeline(new ChineseTokenizer(), preFilters, postFilters);
}

export function createEnglishAnalyzer(
  preFilters?: TokenFilter[],
  postFilters?: TokenFilter[],
): IAnalyzer {
  return new AnalyzerPipeline(new EnglishTokenizer(), preFilters, postFilters);
}

export function createDefaultAnalyzer(
  preFilters?: TokenFilter[],
  postFilters?: TokenFilter[],
): IAnalyzer {
  return new AnalyzerPipeline(new MixedTokenizer(), preFilters, postFilters);
}

export function createCustomAnalyzer(
  tokenizer: ITokenizer,
  preFilters?: TokenFilter[],
  postFilters?: TokenFilter[],
): IAnalyzer {
  return new AnalyzerPipeline(tokenizer, preFilters, postFilters);
}

import { FieldConfig, HighlightSpec } from '../core/types';

export class Highlighter {
  private fieldConfigs: Map<string, FieldConfig>;

  constructor(fieldConfigs: Map<string, FieldConfig>) {
    this.fieldConfigs = fieldConfigs;
  }

  highlight(
    docId: string,
    fieldName: string,
    fieldValue: string,
    queryTerms: Set<string>,
    highlightSpec: HighlightSpec
  ): string[] {
    if (!fieldValue || queryTerms.size === 0) {
      return [];
    }

    const preTag = highlightSpec.preTag ?? '<em>';
    const postTag = highlightSpec.postTag ?? '</em>';
    const fragmentSize = highlightSpec.fragmentSize ?? 100;
    const maxFragments = 3;

    const lowerValue = fieldValue.toLowerCase();
    const termPositions: Array<{ start: number; end: number }> = [];

    for (const term of queryTerms) {
      const lowerTerm = term.toLowerCase();
      let pos = lowerValue.indexOf(lowerTerm);
      while (pos !== -1) {
        termPositions.push({ start: pos, end: pos + lowerTerm.length });
        pos = lowerValue.indexOf(lowerTerm, pos + 1);
      }
    }

    if (termPositions.length === 0) {
      return [];
    }

    termPositions.sort((a, b) => a.start - b.start);

    const merged: Array<{ start: number; end: number }> = [];
    for (const pos of termPositions) {
      if (merged.length === 0 || pos.start > merged[merged.length - 1].end) {
        merged.push({ ...pos });
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, pos.end);
      }
    }

    const fragments: string[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < merged.length && fragments.length < maxFragments; i++) {
      if (usedIndices.has(i)) continue;

      const match = merged[i];
      let fragmentStart = Math.max(0, match.start - Math.floor(fragmentSize / 4));
      let fragmentEnd = Math.min(fieldValue.length, fragmentStart + fragmentSize);

      if (fragmentEnd - fragmentStart < fragmentSize) {
        fragmentStart = Math.max(0, fragmentEnd - fragmentSize);
      }

      for (let j = i + 1; j < merged.length; j++) {
        if (merged[j].start < fragmentEnd) {
          usedIndices.add(j);
        }
      }

      let fragment = fieldValue.substring(fragmentStart, fragmentEnd);
      let offset = fragmentStart;

      const matchesInFragment: Array<{ start: number; end: number }> = [];
      for (const m of merged) {
        if (m.start >= fragmentStart && m.end <= fragmentEnd) {
          matchesInFragment.push({
            start: m.start - offset,
            end: m.end - offset
          });
        }
      }

      matchesInFragment.sort((a, b) => b.start - a.start);

      for (const m of matchesInFragment) {
        const original = fragment.substring(m.start, m.end);
        fragment =
          fragment.substring(0, m.start) +
          preTag +
          original +
          postTag +
          fragment.substring(m.end);
      }

      if (fragmentStart > 0) {
        fragment = '...' + fragment;
      }
      if (fragmentEnd < fieldValue.length) {
        fragment = fragment + '...';
      }

      fragments.push(fragment);
      usedIndices.add(i);
    }

    return fragments;
  }
}

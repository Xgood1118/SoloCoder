export function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

export function globMatch(pattern: string, text: string): boolean {
  const m = pattern.length;
  const n = text.length;
  const dp: boolean[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(false));

  dp[0][0] = true;

  for (let i = 1; i <= m; i++) {
    if (pattern[i - 1] === '*') {
      dp[i][0] = dp[i - 1][0];
    }
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (pattern[i - 1] === '*') {
        dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
      } else if (pattern[i - 1] === '?' || pattern[i - 1] === text[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      }
    }
  }

  return dp[m][n];
}

export function computeBM25(
  tf: number,
  df: number,
  docCount: number,
  avgFieldLength: number,
  fieldLength: number,
  k1: number = 1.2,
  b: number = 0.75
): number {
  const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);
  const tfNorm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (fieldLength / avgFieldLength)));
  return idf * tfNorm;
}

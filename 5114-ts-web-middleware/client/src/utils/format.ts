export function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

export function isValidJSON(json: string): boolean {
  if (!json.trim()) return true;
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

export function parseJSONSafe(data: any): { valid: boolean; data: any } {
  if (typeof data !== 'string') {
    return { valid: true, data };
  }
  try {
    return { valid: true, data: JSON.parse(data) };
  } catch {
    return { valid: false, data };
  }
}

export function getResponseSize(data: any): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const bytes = new Blob([str]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function shouldTruncateResponse(data: any, maxLines: number = 500): {
  shouldTruncate: boolean;
  lineCount: number;
  truncatedText: string;
} {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const lines = str.split('\n');
  const lineCount = lines.length;
  
  if (lineCount > maxLines) {
    return {
      shouldTruncate: true,
      lineCount,
      truncatedText: lines.slice(0, maxLines).join('\n') + `\n\n... (${lineCount - maxLines} more lines truncated)`,
    };
  }
  
  return {
    shouldTruncate: false,
    lineCount,
    truncatedText: str,
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

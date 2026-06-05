import { JSONPath } from 'jsonpath-plus';

export function executeJSONPath(data: any, expression: string): any[] {
  if (!data || !expression) {
    return [];
  }

  try {
    const results = JSONPath({
      path: expression,
      json: data,
      resultType: 'all',
    });
    return results;
  } catch (error) {
    console.error('JSONPath error:', error);
    return [];
  }
}

export function isValidJSONPath(expression: string): boolean {
  if (!expression) return true;
  try {
    JSONPath({ path: expression, json: {}, resultType: 'value' });
    return true;
  } catch {
    return false;
  }
}

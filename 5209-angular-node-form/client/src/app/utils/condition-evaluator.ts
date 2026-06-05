import { Condition } from '../types/form';

export function evaluateCondition(condition: Condition | undefined, data: any): boolean {
  if (!condition) return true;

  switch (condition.op) {
    case 'and':
      return condition.children?.every(c => evaluateCondition(c, data)) ?? true;
    case 'or':
      return condition.children?.some(c => evaluateCondition(c, data)) ?? false;
    case 'eq':
      return getFieldValue(data, condition.field) === condition.value;
    case 'ne':
      return getFieldValue(data, condition.field) !== condition.value;
    case 'gt':
      return Number(getFieldValue(data, condition.field)) > Number(condition.value);
    case 'lt':
      return Number(getFieldValue(data, condition.field)) < Number(condition.value);
    case 'gte':
      return Number(getFieldValue(data, condition.field)) >= Number(condition.value);
    case 'lte':
      return Number(getFieldValue(data, condition.field)) <= Number(condition.value);
    case 'contains':
      return String(getFieldValue(data, condition.field) || '').includes(String(condition.value));
    case 'empty':
      const emptyVal = getFieldValue(data, condition.field);
      return !emptyVal || (Array.isArray(emptyVal) && emptyVal.length === 0);
    case 'notEmpty':
      const notEmptyVal = getFieldValue(data, condition.field);
      return !!notEmptyVal && (!Array.isArray(notEmptyVal) || notEmptyVal.length > 0);
    default:
      return true;
  }
}

function getFieldValue(data: any, field?: string): any {
  if (!field) return undefined;
  return data[field];
}

export function isFieldVisible(field: any, data: any): boolean {
  if (!field.conditionalShow) return true;
  return evaluateCondition(field.conditionalShow, data);
}

export function isFieldRequired(field: any, data: any): boolean {
  if (!field.required) return false;
  if (!field.conditionalRequired) return true;
  return evaluateCondition(field.conditionalRequired, data);
}

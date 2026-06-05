export interface FieldOption {
  label: string;
  value: any;
}

export interface TypeMeta {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  maxFiles?: number;
  maxSize?: number;
  allowedTypes?: string[];
}

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface Condition {
  op: 'and' | 'or' | 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'empty' | 'notEmpty';
  field?: string;
  value?: any;
  children?: Condition[];
}

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'file' | 'rating';

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  typeMeta?: TypeMeta;
  conditionalShow?: Condition;
  conditionalRequired?: Condition;
  formula?: string;
  isLocked?: boolean;
}

export interface FormConfig {
  id?: string;
  name: string;
  description?: string;
  webhookUrl?: string;
  fields: FormField[];
  derivedFrom?: string;
  sharedWith?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  submissionCount?: number;
}

export interface FormVersion {
  id: string;
  formId: string;
  versionNumber: number;
  formData: FormConfig;
  note: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  formId: string;
  data: any;
  is补录: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  formConfig: FormConfig;
  isBuiltIn: boolean;
  createdAt?: string;
}

export interface WebhookLog {
  id: string;
  formId: string;
  submissionId: string;
  url: string;
  status: 'success' | 'retrying' | 'failed';
  error: string | null;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string;
}

export interface Draft {
  id: string;
  formId: string;
  userId: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
}

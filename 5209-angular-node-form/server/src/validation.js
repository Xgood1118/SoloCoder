const { z } = require('zod');

const fieldTypeMetaSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxFiles: z.number().optional(),
  maxSize: z.number().optional(),
  allowedTypes: z.array(z.string()).optional()
}).optional();

const conditionSchema = z.lazy(() => z.object({
  op: z.enum(['and', 'or', 'eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'empty', 'notEmpty']),
  field: z.string().optional(),
  value: z.any().optional(),
  children: z.array(conditionSchema).optional()
}));

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum([
    'text', 'textarea', 'number', 'date', 'time',
    'select', 'multiselect', 'radio', 'checkbox',
    'file', 'rating'
  ]),
  required: z.boolean().optional(),
  defaultValue: z.any().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.any()
  })).optional(),
  validation: z.object({
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  typeMeta: fieldTypeMetaSchema,
  conditionalShow: conditionSchema.optional(),
  conditionalRequired: conditionSchema.optional(),
  formula: z.string().optional(),
  isLocked: z.boolean().optional()
});

const formSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  fields: z.array(fieldSchema),
  derivedFrom: z.string().optional(),
  sharedWith: z.array(z.string()).optional()
});

function createSubmissionSchema(fields) {
  const shape = {};
  fields.forEach(field => {
    let schema;

    switch (field.type) {
      case 'text':
        schema = z.string();
        if (field.typeMeta?.minLength !== undefined) {
          schema = schema.min(field.typeMeta.minLength);
        }
        if (field.typeMeta?.maxLength !== undefined) {
          schema = schema.max(field.typeMeta.maxLength);
        }
        if (field.validation?.pattern) {
          schema = schema.regex(new RegExp(field.validation.pattern));
        }
        break;

      case 'textarea':
        schema = z.string();
        if (field.typeMeta?.minLength !== undefined) {
          schema = schema.min(field.typeMeta.minLength);
        }
        if (field.typeMeta?.maxLength !== undefined) {
          schema = schema.max(field.typeMeta.maxLength);
        }
        break;

      case 'number':
        schema = z.coerce.number();
        if (field.typeMeta?.min !== undefined) {
          schema = schema.min(field.typeMeta.min);
        }
        if (field.typeMeta?.max !== undefined) {
          schema = schema.max(field.typeMeta.max);
        }
        break;

      case 'date':
      case 'time':
        schema = z.string();
        break;

      case 'select':
      case 'radio':
        schema = z.any();
        break;

      case 'multiselect':
      case 'checkbox':
        schema = z.array(z.any()).optional();
        break;

      case 'file':
        schema = z.array(z.object({
          filename: z.string(),
          originalName: z.string(),
          path: z.string(),
          mimetype: z.string(),
          size: z.number()
        })).optional();
        break;

      case 'rating':
        schema = z.coerce.number().int().min(1).max(5);
        break;

      default:
        schema = z.any();
    }

    if (!field.required) {
      schema = schema.optional().or(z.literal('')).or(z.null());
    }

    shape[field.key] = schema;
  });

  return z.object(shape);
}

module.exports = {
  formSchema,
  createSubmissionSchema,
  fieldSchema
};

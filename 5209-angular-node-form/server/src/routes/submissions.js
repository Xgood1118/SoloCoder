const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const storage = require('../storage');
const { createSubmissionSchema } = require('../validation');
const { triggerWebhook, replayWebhook } = require('../webhook');

function evaluateCondition(condition, data) {
  if (!condition) return true;

  switch (condition.op) {
    case 'and':
      return condition.children?.every(c => evaluateCondition(c, data)) ?? true;
    case 'or':
      return condition.children?.some(c => evaluateCondition(c, data)) ?? false;
    case 'eq':
      return data[condition.field] === condition.value;
    case 'ne':
      return data[condition.field] !== condition.value;
    case 'gt':
      return data[condition.field] > condition.value;
    case 'lt':
      return data[condition.field] < condition.value;
    case 'gte':
      return data[condition.field] >= condition.value;
    case 'lte':
      return data[condition.field] <= condition.value;
    case 'contains':
      return String(data[condition.field] || '').includes(String(condition.value));
    case 'empty':
      return !data[condition.field] || (Array.isArray(data[condition.field]) && data[condition.field].length === 0);
    case 'notEmpty':
      return !!data[condition.field] && (!Array.isArray(data[condition.field]) || data[condition.field].length > 0);
    default:
      return true;
  }
}

function getRequiredFields(fields, data) {
  return fields.filter(field => {
    if (!field.conditionalRequired) return field.required;
    return field.required && evaluateCondition(field.conditionalRequired, data);
  });
}

router.get('/:formId/submissions', (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  let submissions = storage.getSubmissions(req.params.formId);

  const { startDate, endDate, field, operator, value } = req.query;
  if (startDate) {
    submissions = submissions.filter(s => new Date(s.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    submissions = submissions.filter(s => new Date(s.createdAt) <= new Date(endDate));
  }

  if (field && operator && value !== undefined) {
    submissions = submissions.filter(s => {
      const fieldValue = s.data[field];
      switch (operator) {
        case 'eq':
          return fieldValue == value;
        case 'ne':
          return fieldValue != value;
        case 'gt':
          return Number(fieldValue) > Number(value);
        case 'lt':
          return Number(fieldValue) < Number(value);
        case 'gte':
          return Number(fieldValue) >= Number(value);
        case 'lte':
          return Number(fieldValue) <= Number(value);
        case 'contains':
          return String(fieldValue).includes(String(value));
        default:
          return true;
      }
    });
  }

  res.json(submissions);
});

router.post('/:formId/submit', async (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const requiredFields = getRequiredFields(form.fields, req.body);
  const submissionSchema = createSubmissionSchema(requiredFields);
  
  const result = submissionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.errors });
  }

  const submission = storage.createSubmission(req.params.formId, result.data, false);
  
  if (form.webhookUrl) {
    triggerWebhook(req.params.formId, submission);
  }

  res.status(201).json(submission);
});

router.post('/:formId/submissions/manual', (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const submission = storage.createSubmission(req.params.formId, req.body, true);
  res.status(201).json(submission);
});

router.delete('/:formId/submissions/:id', (req, res) => {
  const deleted = storage.deleteSubmission(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  res.json({ success: true });
});

router.delete('/:formId/submissions', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }
  storage.deleteSubmissions(ids);
  res.json({ success: true });
});

router.post('/submissions/:id/replay', async (req, res) => {
  const result = await replayWebhook(req.params.id);
  res.json(result);
});

router.get('/:formId/submissions/export/json', (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const submissions = storage.getSubmissions(req.params.formId);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${form.name}-submissions.json"`);
  res.json(submissions);
});

router.get('/:formId/submissions/export/csv', (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const submissions = storage.getSubmissions(req.params.formId);
  const fieldKeys = form.fields.map(f => f.key);
  
  const csvRows = [
    ['ID', '提交时间', '是否补录', ...fieldKeys].join(',')
  ];

  submissions.forEach(sub => {
    const row = [
      sub.id,
      sub.createdAt,
      sub.is补录 ? '是' : '否',
      ...fieldKeys.map(key => {
        let value = sub.data[key];
        if (Array.isArray(value)) {
          value = value.join(';');
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      })
    ];
    csvRows.push(row.join(','));
  });

  const bom = '\uFEFF';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${form.name}-submissions.csv"`);
  res.send(bom + csvRows.join('\n'));
});

router.get('/:formId/submissions/export/excel', (req, res) => {
  const form = storage.getForm(req.params.formId);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }

  const submissions = storage.getSubmissions(req.params.formId);
  const fieldKeys = form.fields.map(f => f.key);

  const data = submissions.map(sub => {
    const row = {
      'ID': sub.id,
      '提交时间': sub.createdAt,
      '是否补录': sub.is补录 ? '是' : '否'
    };
    fieldKeys.forEach(key => {
      let value = sub.data[key];
      if (Array.isArray(value)) {
        value = value.join(';');
      }
      row[key] = value;
    });
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${form.name}-submissions.xlsx"`);
  res.send(buffer);
});

module.exports = router;

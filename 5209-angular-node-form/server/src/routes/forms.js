const express = require('express');
const router = express.Router();
const storage = require('../storage');
const { formSchema, createSubmissionSchema } = require('../validation');
const { triggerWebhook, replayWebhook } = require('../webhook');

router.get('/', (req, res) => {
  const forms = storage.getForms().map(form => ({
    ...form,
    submissionCount: storage.getSubmissions(form.id).length
  }));
  res.json(forms);
});

router.get('/:id', (req, res) => {
  const form = storage.getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }
  res.json(form);
});

router.post('/', (req, res) => {
  const result = formSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid form data', details: result.error.errors });
  }
  const form = storage.createForm(result.data);
  res.status(201).json(form);
});

router.patch('/:id', (req, res) => {
  const existing = storage.getForm(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Form not found' });
  }
  const result = formSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid form data', details: result.error.errors });
  }
  const updated = storage.updateForm(req.params.id, result.data, req.body.changeNote);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const deleted = storage.deleteForm(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Form not found' });
  }
  res.json({ success: true });
});

router.post('/:id/copy', (req, res) => {
  const original = storage.getForm(req.params.id);
  if (!original) {
    return res.status(404).json({ error: 'Form not found' });
  }
  const copy = storage.createForm({
    ...original,
    name: original.name + ' 副本',
    derivedFrom: original.id,
    version: undefined,
    createdAt: undefined,
    updatedAt: undefined
  });
  res.status(201).json(copy);
});

router.get('/:id/versions', (req, res) => {
  const versions = storage.getFormVersions(req.params.id);
  res.json(versions);
});

router.post('/:id/versions/:versionId/rollback', (req, res) => {
  const rolledBack = storage.rollbackToVersion(req.params.id, req.params.versionId);
  if (!rolledBack) {
    return res.status(404).json({ error: 'Form or version not found' });
  }
  res.json(rolledBack);
});

router.post('/:id/share', (req, res) => {
  const { users } = req.body;
  const form = storage.shareForm(req.params.id, users);
  if (!form) {
    return res.status(404).json({ error: 'Form not found' });
  }
  res.json(form);
});

module.exports = router;

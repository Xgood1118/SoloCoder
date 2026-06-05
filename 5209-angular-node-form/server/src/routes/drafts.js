const express = require('express');
const router = express.Router();
const storage = require('../storage');

router.get('/:formId', (req, res) => {
  const { userId = 'anonymous' } = req.query;
  const draft = storage.getDraft(req.params.formId, userId);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  res.json(draft);
});

router.post('/:formId', (req, res) => {
  const { userId = 'anonymous' } = req.query;
  const { data } = req.body;
  const draft = storage.createDraft(req.params.formId, data, userId);
  res.status(201).json(draft);
});

router.delete('/:id', (req, res) => {
  const deleted = storage.deleteDraft(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  res.json({ success: true });
});

module.exports = router;

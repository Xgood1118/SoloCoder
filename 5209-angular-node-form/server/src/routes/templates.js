const express = require('express');
const router = express.Router();
const storage = require('../storage');

router.get('/', (req, res) => {
  const templates = storage.getTemplates();
  res.json(templates);
});

router.get('/:id', (req, res) => {
  const template = storage.getTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

router.post('/', (req, res) => {
  const { name, description, formConfig } = req.body;
  if (!name || !formConfig) {
    return res.status(400).json({ error: 'Name and formConfig are required' });
  }
  const template = storage.createTemplate({ name, description, formConfig });
  res.status(201).json(template);
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const path = require('path');

const formsRouter = require('./routes/forms');
const submissionsRouter = require('./routes/submissions');
const templatesRouter = require('./routes/templates');
const uploadsRouter = require('./routes/uploads');
const webhookLogsRouter = require('./routes/webhook-logs');
const draftsRouter = require('./routes/drafts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/forms', submissionsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api', uploadsRouter);
app.use('/api/webhook-logs', webhookLogsRouter);
app.use('/api/drafts', draftsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});

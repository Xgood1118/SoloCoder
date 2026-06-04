import express from 'express';
import cors from 'cors';
import path from 'path';

import articlesRouter from './routes/articles';
import categoriesRouter from './routes/categories';
import tagsRouter from './routes/tags';
import templatesRouter from './routes/templates';
import approvalsRouter from './routes/approvals';
import logsRouter from './routes/logs';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/articles', articlesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/logs', logsRouter);

app.use(express.static(path.join(__dirname, '../../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`CMS 服务器运行在 http://localhost:${PORT}`);
});

export default app;

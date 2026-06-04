import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';
import { logOperation } from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const templates = [...db.templates]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(templates);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const template = db.templates.find(t => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: '模板不存在' });
  }
  res.json(template);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, type, layout_config } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  const newTemplate = {
    id,
    name,
    type,
    layout_config: layout_config || {},
    created_at: now,
    updated_at: now
  };

  db.templates.push(newTemplate);
  persist();
  logOperation('system', '系统用户', 'create', 'template', id, `创建模板: ${name}`);

  res.status(201).json({ id, name, type });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, type, layout_config } = req.body;
  const { id } = req.params;

  const template = db.templates.find(t => t.id === id);
  if (!template) {
    return res.status(404).json({ error: '模板不存在' });
  }

  template.name = name;
  template.type = type;
  if (layout_config !== undefined) {
    template.layout_config = layout_config;
  }
  template.updated_at = new Date().toISOString();
  persist();

  logOperation('system', '系统用户', 'update', 'template', id, `更新模板`);

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  
  const template = db.templates.find(t => t.id === id);
  if (!template) {
    return res.status(404).json({ error: '模板不存在' });
  }

  db.templates = db.templates.filter(t => t.id !== id);
  persist();
  logOperation('system', '系统用户', 'delete', 'template', id, `删除模板: ${template.name}`);

  res.json({ success: true });
});

export default router;

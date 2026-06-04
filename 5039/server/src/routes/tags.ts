import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';
import { logOperation } from '../utils/logger';
import { Tag } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const tags = [...db.tags].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json(tags);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const tag = db.tags.find(t => t.id === req.params.id);
  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }
  res.json(tag);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name } = req.body;
  const id = uuidv4();
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const now = new Date().toISOString();

  const newTag: Tag = {
    id,
    name,
    slug,
    created_at: now
  };

  db.tags.push(newTag);
  persist();
  logOperation('system', '系统用户', 'create', 'tag', id, `创建标签: ${name}`);

  res.status(201).json({ id, name, slug });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name } = req.body;
  const { id } = req.params;
  const slug = name.toLowerCase().replace(/\s+/g, '-');

  const tag = db.tags.find(t => t.id === id);
  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }

  tag.name = name;
  tag.slug = slug;
  persist();

  logOperation('system', '系统用户', 'update', 'tag', id, `更新标签`);

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  
  const tag = db.tags.find(t => t.id === id);
  if (!tag) {
    return res.status(404).json({ error: '标签不存在' });
  }

  db.tags = db.tags.filter(t => t.id !== id);
  persist();
  logOperation('system', '系统用户', 'delete', 'tag', id, `删除标签: ${tag.name}`);

  res.json({ success: true });
});

export default router;

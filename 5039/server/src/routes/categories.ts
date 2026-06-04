import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db';
import { logOperation } from '../utils/logger';
import { Category } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const categories = [...db.categories].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json(categories);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const category = db.categories.find(c => c.id === req.params.id);
  if (!category) {
    return res.status(404).json({ error: '分类不存在' });
  }
  res.json(category);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, parent_id } = req.body;
  const id = uuidv4();
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const now = new Date().toISOString();

  const newCategory: Category = {
    id,
    name,
    slug,
    description,
    parent_id: parent_id || null,
    created_at: now,
    updated_at: now
  };

  db.categories.push(newCategory);
  persist();
  logOperation('system', '系统用户', 'create', 'category', id, `创建分类: ${name}`);

  res.status(201).json({ id, name, slug });
});

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, parent_id } = req.body;
  const { id } = req.params;

  const category = db.categories.find(c => c.id === id);
  if (!category) {
    return res.status(404).json({ error: '分类不存在' });
  }

  category.name = name;
  category.description = description;
  category.parent_id = parent_id || null;
  category.updated_at = new Date().toISOString();
  persist();

  logOperation('system', '系统用户', 'update', 'category', id, `更新分类`);

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  
  const category = db.categories.find(c => c.id === id);
  if (!category) {
    return res.status(404).json({ error: '分类不存在' });
  }

  db.categories = db.categories.filter(c => c.id !== id);
  persist();
  logOperation('system', '系统用户', 'delete', 'category', id, `删除分类: ${category.name}`);

  res.json({ success: true });
});

export default router;

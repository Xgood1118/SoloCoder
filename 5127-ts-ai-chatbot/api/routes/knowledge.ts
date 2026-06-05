import { Router, type Request, type Response } from 'express';
import * as knowledgeService from '../services/knowledge.service.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (_req: Request, res: Response) => {
  const docs = knowledgeService.getKnowledgeDocs();
  res.json(docs);
});

router.post('/', adminMiddleware, validateBody(['title', 'content', 'category']), (req: Request, res: Response) => {
  const { title, content, category } = req.body;
  const doc = knowledgeService.addKnowledgeDoc(title, content, category);
  res.json(doc);
});

router.delete('/:id', adminMiddleware, (req: Request, res: Response) => {
  const success = knowledgeService.deleteKnowledgeDoc(req.params.id);
  res.json({ success });
});

export default router;

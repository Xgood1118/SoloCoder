import { Router, type Request, type Response } from 'express';
import * as sensitiveWordService from '../services/sensitive-word.service.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateBody, validateEnum } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (_req: Request, res: Response) => {
  const words = sensitiveWordService.getSensitiveWords();
  res.json(words);
});

router.post(
  '/',
  adminMiddleware,
  validateBody(['word', 'level']),
  validateEnum('level', ['low', 'medium', 'high']),
  (req: Request, res: Response) => {
    const { word, level, category } = req.body;
    const result = sensitiveWordService.addSensitiveWord(word, level, category || '通用');
    res.json(result);
  }
);

router.put(
  '/:id',
  adminMiddleware,
  validateEnum('level', ['low', 'medium', 'high']),
  (req: Request, res: Response) => {
    const { word, level, category } = req.body;
    const result = sensitiveWordService.updateSensitiveWord(req.params.id, word, level, category);
    if (!result) { res.status(404).json({ error: 'Sensitive word not found' }); return; }
    res.json(result);
  }
);

router.delete('/:id', adminMiddleware, (req: Request, res: Response) => {
  const success = sensitiveWordService.deleteSensitiveWord(req.params.id);
  res.json({ success });
});

router.post('/batch', adminMiddleware, validateBody(['words']), (req: Request, res: Response) => {
  const { words } = req.body;
  if (!Array.isArray(words)) { res.status(400).json({ error: 'words 必须是数组' }); return; }
  const result = sensitiveWordService.batchImport(words);
  res.json(result);
});

export default router;

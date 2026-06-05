import { Router, type Request, type Response } from 'express';
import * as historyService from '../services/history.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

router.get('/search', validateQuery(['q']), (req: Request, res: Response) => {
  const userId = req.userId!;
  const q = req.query.q as string;
  const results = historyService.searchHistory(userId, q);
  res.json(results);
});

router.post('/copy', validateBody(['sourceSessionId', 'targetSessionId', 'messageIds']), (req: Request, res: Response) => {
  const { sourceSessionId, targetSessionId, messageIds } = req.body;
  const success = historyService.copyMessages(sourceSessionId, targetSessionId, messageIds);
  res.json({ success });
});

export default router;

import { Router, type Request, type Response } from 'express';
import * as sessionService from '../services/session.service.js';
import * as messageRepo from '../repositories/message.repository.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req: Request, res: Response) => {
  const userId = req.userId!;
  const sessions = sessionService.getSessionsByUserId(userId);
  res.json(sessions);
});

router.post('/', validateBody(['title']), (req: Request, res: Response) => {
  const userId = req.userId!;
  const { title } = req.body;
  const session = sessionService.createSession(userId, title);
  res.json(session);
});

router.put('/:id', validateBody(['title']), (req: Request, res: Response) => {
  const { title } = req.body;
  const session = sessionService.renameSession(req.params.id, title);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

router.delete('/:id', (req: Request, res: Response) => {
  const success = sessionService.deleteSession(req.params.id);
  res.json({ success });
});

router.get('/:id/messages', (req: Request, res: Response) => {
  const messages = messageRepo.findBySessionId(req.params.id);
  res.json(messages);
});

export default router;

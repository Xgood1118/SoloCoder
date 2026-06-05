import { Router, type Request, type Response } from 'express';
import * as chatService from '../services/chat.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

router.post('/', validateBody(['sessionId', 'message']), async (req: Request, res: Response) => {
  const { sessionId, message } = req.body;
  const userId = req.userId!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = chatService.chat(sessionId, userId, message);
    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
    res.end();
  }
});

export default router;

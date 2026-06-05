import { Router, type Request, type Response } from 'express';
import * as userRepo from '../repositories/user.repository.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

function sanitizeUser(user: any) {
  const { password, ...rest } = user;
  return rest;
}

router.get('/', (_req: Request, res: Response) => {
  const users = userRepo.findAll();
  res.json(users.map(sanitizeUser));
});

router.put('/:id/status', validateBody(['enabled']), (req: Request, res: Response) => {
  const { enabled } = req.body;
  userRepo.updateEnabled(req.params.id, enabled);
  res.json({ success: true });
});

export default router;

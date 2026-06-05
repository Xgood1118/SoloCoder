import { Router, type Request, type Response } from 'express';
import { createRequire } from 'module';
import * as userRepo from '../repositories/user.repository.js';
import { generateToken } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const user = userRepo.findByUsername(username);
  if (!user) { res.status(401).json({ error: '用户名或密码错误' }); return; }
  const match = await bcrypt.compare(password, user.password);
  if (!match) { res.status(401).json({ error: '用户名或密码错误' }); return; }
  if (!user.enabled) { res.status(403).json({ error: '账号已被禁用' }); return; }
  userRepo.updateLastLogin(user.id);
  const { password: _, ...userWithoutPassword } = user;
  const token = generateToken(user.id, user.role);
  res.json({ token, user: userWithoutPassword });
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) { res.status(400).json({ error: '用户名和密码不能为空' }); return; }
  if (password.length < 6) { res.status(400).json({ error: '密码长度不能少于6位' }); return; }
  const existing = userRepo.findByUsername(username);
  if (existing) { res.status(409).json({ error: '用户名已存在' }); return; }
  const hashedPassword = await bcrypt.hash(password, 10);
  const allUsers = userRepo.findAll();
  const role = allUsers.length === 0 ? 'admin' : 'user';
  const user = userRepo.create(username, hashedPassword, role);
  const { password: _, ...userWithoutPassword } = user;
  const token = generateToken(user.id, user.role);
  res.json({ token, user: userWithoutPassword });
});

export default router;

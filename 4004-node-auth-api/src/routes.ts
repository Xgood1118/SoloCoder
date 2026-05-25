import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from './middleware/auth';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  logoutAllHandler,
  revokeSessionHandler,
  changePasswordHandler,
} from './controllers/auth';
import { meHandler, loginLogsHandler } from './controllers/user';
import {
  checkPermissionHandler,
  checkPermissionsHandler,
  listPermissionsHandler,
} from './controllers/permission';
import { departmentsHandler } from './controllers/department';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, loginHandler);
router.post('/refresh', refreshHandler);

router.use(authenticate);

router.get('/me', meHandler);
router.post('/logout', logoutHandler);
router.post('/logout/all', logoutAllHandler);
router.delete('/sessions/:sessionId', revokeSessionHandler);

router.post('/password/change', changePasswordHandler);

router.get('/me/login-logs', loginLogsHandler);

router.get('/permissions', listPermissionsHandler);
router.get('/permissions/check', checkPermissionHandler);
router.get('/permissions/batch', checkPermissionsHandler);

router.get('/departments', departmentsHandler);

export { router as apiRouter };

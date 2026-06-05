const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validatePassword, validateRegister, validateLoginInput, xssSanitize } = require('../middleware/security');

router.post('/register', xssSanitize, validateRegister, authController.register);
router.post('/login', xssSanitize, validateLoginInput, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.getCurrentUser);
router.get('/menus', authenticateToken, authController.getUserMenus);

module.exports = router;

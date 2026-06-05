const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { xssSanitize, validatePassword } = require('../middleware/security');

router.use(authenticateToken);
router.use(requireRole('超级管理员'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', xssSanitize, validatePassword, userController.createUser);
router.put('/:id', xssSanitize, userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;

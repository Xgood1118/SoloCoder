const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { xssSanitize } = require('../middleware/security');

router.use(authenticateToken);
router.use(requireRole('超级管理员'));

router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', xssSanitize, roleController.createRole);
router.put('/:id', xssSanitize, roleController.updateRole);
router.delete('/:id', roleController.deleteRole);
router.get('/:id/menus', roleController.getRoleMenus);
router.post('/:id/menus', roleController.assignMenus);

module.exports = router;

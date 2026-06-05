const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { xssSanitize } = require('../middleware/security');

router.use(authenticateToken);

router.get('/', menuController.getAllMenus);
router.get('/flat', menuController.getAllMenusFlat);
router.get('/:id', menuController.getMenuById);

router.use(requireRole('超级管理员'));
router.post('/', xssSanitize, menuController.createMenu);
router.put('/:id', xssSanitize, menuController.updateMenu);
router.delete('/:id', menuController.deleteMenu);

module.exports = router;

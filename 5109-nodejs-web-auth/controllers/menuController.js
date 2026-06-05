const Menu = require('../models/Menu');
const { formatError } = require('../middleware/security');

exports.getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.findAll();
    const menuTree = Menu.buildTree(menus);
    res.json(menuTree);
  } catch (error) {
    console.error('[Menu] GetAll error:', formatError(error));
    res.status(500).json({ message: '获取菜单列表失败', error: formatError(error) });
  }
};

exports.getAllMenusFlat = async (req, res) => {
  try {
    const menus = await Menu.findAll();
    res.json(menus);
  } catch (error) {
    console.error('[Menu] GetAllFlat error:', formatError(error));
    res.status(500).json({ message: '获取菜单列表失败', error: formatError(error) });
  }
};

exports.getMenuById = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ message: '菜单不存在' });
    }
    res.json(menu);
  } catch (error) {
    console.error('[Menu] GetById error:', formatError(error));
    res.status(500).json({ message: '获取菜单失败', error: formatError(error) });
  }
};

exports.createMenu = async (req, res) => {
  try {
    const { parent_id, name, path, icon, sort_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: '菜单名称不能为空' });
    }

    const menuId = await Menu.create({ parent_id, name, path, icon, sort_order });
    res.status(201).json({
      message: '菜单创建成功',
      menuId
    });
  } catch (error) {
    console.error('[Menu] Create error:', formatError(error));
    res.status(500).json({ message: '创建菜单失败', error: formatError(error) });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { parent_id, name, path, icon, sort_order } = req.body;
    const menuId = req.params.id;

    const existingMenu = await Menu.findById(menuId);
    if (!existingMenu) {
      return res.status(404).json({ message: '菜单不存在' });
    }

    await Menu.update(menuId, { parent_id, name, path, icon, sort_order });
    res.json({ message: '菜单更新成功' });
  } catch (error) {
    console.error('[Menu] Update error:', formatError(error));
    res.status(500).json({ message: '更新菜单失败', error: formatError(error) });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const menuId = req.params.id;

    const existingMenu = await Menu.findById(menuId);
    if (!existingMenu) {
      return res.status(404).json({ message: '菜单不存在' });
    }

    await Menu.delete(menuId);
    res.json({ message: '菜单删除成功' });
  } catch (error) {
    console.error('[Menu] Delete error:', formatError(error));
    res.status(500).json({ message: '删除菜单失败', error: formatError(error) });
  }
};

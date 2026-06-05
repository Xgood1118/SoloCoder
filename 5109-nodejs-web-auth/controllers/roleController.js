const Role = require('../models/Role');
const { formatError } = require('../middleware/security');

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.json(roles);
  } catch (error) {
    console.error('[Role] GetAll error:', formatError(error));
    res.status(500).json({ message: '获取角色列表失败', error: formatError(error) });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: '角色不存在' });
    }
    res.json(role);
  } catch (error) {
    console.error('[Role] GetById error:', formatError(error));
    res.status(500).json({ message: '获取角色失败', error: formatError(error) });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, description, data_scope } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: '角色名称不能为空' });
    }

    const roleId = await Role.create({ name, description, data_scope });
    res.status(201).json({
      message: '角色创建成功',
      roleId
    });
  } catch (error) {
    console.error('[Role] Create error:', formatError(error));
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '角色名称已存在' });
    }
    res.status(500).json({ message: '创建角色失败', error: formatError(error) });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { name, description, data_scope } = req.body;
    const roleId = req.params.id;

    const existingRole = await Role.findById(roleId);
    if (!existingRole) {
      return res.status(404).json({ message: '角色不存在' });
    }

    await Role.update(roleId, { name, description, data_scope });
    res.json({ message: '角色更新成功' });
  } catch (error) {
    console.error('[Role] Update error:', formatError(error));
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '角色名称已存在' });
    }
    res.status(500).json({ message: '更新角色失败', error: formatError(error) });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    const existingRole = await Role.findById(roleId);
    if (!existingRole) {
      return res.status(404).json({ message: '角色不存在' });
    }

    await Role.delete(roleId);
    res.json({ message: '角色删除成功' });
  } catch (error) {
    console.error('[Role] Delete error:', formatError(error));
    res.status(500).json({ message: '删除角色失败', error: formatError(error) });
  }
};

exports.getRoleMenus = async (req, res) => {
  try {
    const menus = await Role.getMenus(req.params.id);
    res.json(menus);
  } catch (error) {
    console.error('[Role] GetMenus error:', formatError(error));
    res.status(500).json({ message: '获取角色菜单失败', error: formatError(error) });
  }
};

exports.assignMenus = async (req, res) => {
  try {
    const { menuIds } = req.body;
    await Role.assignMenus(req.params.id, menuIds);
    res.json({ message: '菜单分配成功' });
  } catch (error) {
    console.error('[Role] AssignMenus error:', formatError(error));
    res.status(500).json({ message: '分配菜单失败', error: formatError(error) });
  }
};

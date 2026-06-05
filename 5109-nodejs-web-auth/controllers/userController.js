const User = require('../models/User');
const { formatError } = require('../middleware/security');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('[User] GetAll error:', formatError(error));
    res.status(500).json({ message: '获取用户列表失败', error: formatError(error) });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json(user);
  } catch (error) {
    console.error('[User] GetById error:', formatError(error));
    res.status(500).json({ message: '获取用户失败', error: formatError(error) });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, phone, password, role_id, team_id } = req.body;

    if (!username && !email && !phone) {
      return res.status(400).json({ message: '用户名、邮箱或手机号至少填写一个' });
    }

    const userId = await User.create({ username, email, phone, password, role_id, team_id });
    res.status(201).json({
      message: '用户创建成功',
      userId
    });
  } catch (error) {
    console.error('[User] Create error:', formatError(error));
    if (error.code === 'ER_DUP_ENTRY') {
      const dupField = error.sqlMessage && error.sqlMessage.includes('username') ? '用户名'
        : error.sqlMessage && error.sqlMessage.includes('email') ? '邮箱'
        : error.sqlMessage && error.sqlMessage.includes('phone') ? '手机号'
        : '账号';
      return res.status(400).json({ message: `${dupField}已存在` });
    }
    res.status(500).json({ message: '创建用户失败', error: formatError(error) });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { username, email, phone, password, role_id, team_id } = req.body;
    const userId = req.params.id;

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: '用户不存在' });
    }

    await User.update(userId, { username, email, phone, password, role_id, team_id });
    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('[User] Update error:', formatError(error));
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '用户名、邮箱或手机号已存在' });
    }
    res.status(500).json({ message: '更新用户失败', error: formatError(error) });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: '用户不存在' });
    }

    await User.delete(userId);
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('[User] Delete error:', formatError(error));
    res.status(500).json({ message: '删除用户失败', error: formatError(error) });
  }
};

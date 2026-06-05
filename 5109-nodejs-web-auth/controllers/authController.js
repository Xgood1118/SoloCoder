const User = require('../models/User');
const Token = require('../models/Token');
const Menu = require('../models/Menu');
const { formatError } = require('../middleware/security');

exports.register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    const userId = await User.create({ username, email, phone, password });

    res.status(201).json({
      message: '注册成功',
      userId
    });
  } catch (error) {
    console.error('[Auth] Register error:', formatError(error));
    if (error.code === 'ER_DUP_ENTRY') {
      const dupField = error.sqlMessage.includes('username') ? '用户名'
        : error.sqlMessage.includes('email') ? '邮箱'
        : error.sqlMessage.includes('phone') ? '手机号'
        : '账号';
      return res.status(400).json({ message: `${dupField}已存在` });
    }
    res.status(500).json({ message: '注册失败', error: formatError(error) });
  }
};

exports.login = async (req, res) => {
  try {
    const { account, password } = req.body;

    const user = await User.findByAccount(account);
    if (!user) {
      return res.status(401).json({ message: '账号或密码错误' });
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '账号或密码错误' });
    }

    const accessToken = Token.generateAccessToken(user.id);
    const refreshToken = Token.generateRefreshToken(user.id);

    await Token.saveRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: '登录成功',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        roleName: user.role_name,
        dataScope: user.data_scope
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', formatError(error));
    res.status(500).json({ message: '登录失败', error: formatError(error) });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: '未提供刷新令牌' });
    }

    let decoded;
    try {
      decoded = Token.verifyRefreshToken(refreshToken);
    } catch (jwtErr) {
      return res.status(403).json({ message: '刷新令牌无效或已过期，请重新登录' });
    }

    const storedToken = await Token.findRefreshToken(refreshToken);

    if (!storedToken) {
      return res.status(403).json({ message: '刷新令牌不存在或已被撤销，请重新登录' });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await Token.deleteRefreshToken(refreshToken);
      return res.status(403).json({ message: '刷新令牌已过期，请重新登录' });
    }

    const newAccessToken = Token.generateAccessToken(decoded.userId);

    res.json({
      accessToken: newAccessToken,
      message: '令牌刷新成功'
    });
  } catch (error) {
    console.error('[Auth] Refresh token error:', formatError(error));
    res.status(403).json({ message: '令牌刷新失败', error: formatError(error) });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await Token.deleteRefreshToken(refreshToken);
    }

    res.clearCookie('refreshToken');
    res.json({ message: '登出成功' });
  } catch (error) {
    console.error('[Auth] Logout error:', formatError(error));
    res.clearCookie('refreshToken');
    res.json({ message: '登出成功' });
  }
};

exports.getUserMenus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const menus = await Menu.getByRoleId(user.role_id);
    const menuTree = Menu.buildTree(menus);

    res.json({
      menus: menuTree,
      user: {
        id: user.id,
        username: user.username,
        roleName: user.role_name,
        dataScope: user.data_scope
      }
    });
  } catch (error) {
    console.error('[Auth] Get menus error:', formatError(error));
    res.status(500).json({ message: '获取菜单失败', error: formatError(error) });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      roleName: user.role_name,
      dataScope: user.data_scope
    });
  } catch (error) {
    console.error('[Auth] Get current user error:', formatError(error));
    res.status(500).json({ message: '获取用户信息失败', error: formatError(error) });
  }
};

const Customer = require('../models/Customer');
const User = require('../models/User');
const { formatError } = require('../middleware/security');

exports.getAllCustomers = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const customers = await Customer.findAllWithDataScope(
      user.id,
      user.team_id,
      user.data_scope
    );

    res.json({
      data: customers,
      dataScope: user.data_scope,
      message: '数据权限: ' + (user.data_scope === 'all' ? '全部' : user.data_scope === 'team' ? '团队' : '个人')
    });
  } catch (error) {
    console.error('[Customer] GetAll error:', formatError(error));
    res.status(500).json({ message: '获取客户列表失败', error: formatError(error) });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customerId = req.params.id;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const customer = await Customer.findByIdWithPermission(
      customerId,
      user.id,
      user.team_id,
      user.data_scope
    );

    if (!customer) {
      return res.status(403).json({
        message: '无权访问该客户数据，可能存在越权访问行为已被拦截',
        errorCode: 'IDOR_BLOCKED'
      });
    }

    res.json(customer);
  } catch (error) {
    console.error('[Customer] GetById error:', formatError(error));
    res.status(500).json({ message: '获取客户失败', error: formatError(error) });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const { name, phone, email, company } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: '客户名称不能为空' });
    }

    const customerId = await Customer.create({
      name,
      phone,
      email,
      company,
      owner_id: user.id,
      team_id: user.team_id
    });

    res.status(201).json({
      message: '客户创建成功',
      customerId
    });
  } catch (error) {
    console.error('[Customer] Create error:', formatError(error));
    res.status(500).json({ message: '创建客户失败', error: formatError(error) });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { name, phone, email, company } = req.body;

    const user = await User.findById(req.user.userId);
    const customer = await Customer.findByIdWithPermission(
      customerId,
      user.id,
      user.team_id,
      user.data_scope
    );

    if (!customer) {
      return res.status(403).json({
        message: '无权修改该客户数据',
        errorCode: 'IDOR_BLOCKED'
      });
    }

    await Customer.update(customerId, { name, phone, email, company });
    res.json({ message: '客户更新成功' });
  } catch (error) {
    console.error('[Customer] Update error:', formatError(error));
    res.status(500).json({ message: '更新客户失败', error: formatError(error) });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;

    const user = await User.findById(req.user.userId);
    const customer = await Customer.findByIdWithPermission(
      customerId,
      user.id,
      user.team_id,
      user.data_scope
    );

    if (!customer) {
      return res.status(403).json({
        message: '无权删除该客户数据',
        errorCode: 'IDOR_BLOCKED'
      });
    }

    await Customer.delete(customerId);
    res.json({ message: '客户删除成功' });
  } catch (error) {
    console.error('[Customer] Delete error:', formatError(error));
    res.status(500).json({ message: '删除客户失败', error: formatError(error) });
  }
};

exports.checkDataPermission = async (req, res, next) => {
  try {
    const customerId = req.params.id || req.body.id;
    if (!customerId) return next();

    const user = await User.findById(req.user.userId);
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({ message: '客户不存在' });
    }

    let hasPermission = false;

    if (user.data_scope === 'all') {
      hasPermission = true;
    } else if (user.data_scope === 'team') {
      hasPermission = await Customer.checkTeamAccess(customerId, user.team_id);
    } else if (user.data_scope === 'self') {
      hasPermission = await Customer.checkOwnership(customerId, user.id);
    }

    if (!hasPermission) {
      return res.status(403).json({
        message: '数据权限校验失败，越权访问已被拦截',
        errorCode: 'IDOR_BLOCKED'
      });
    }

    next();
  } catch (error) {
    console.error('[Customer] CheckPermission error:', formatError(error));
    res.status(500).json({ message: '权限校验失败', error: formatError(error) });
  }
};

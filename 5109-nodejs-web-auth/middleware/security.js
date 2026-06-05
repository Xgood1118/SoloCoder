const xss = require('xss');
const { body, validationResult } = require('express-validator');

const xssSanitize = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  next();
};

const validatePassword = [
  body('password')
    .exists({ checkFalsy: true })
    .withMessage('密码不能为空')
    .isLength({ min: 8 })
    .withMessage('密码至少8位')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('密码必须包含字母和数字'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '密码强度不符合要求', errors: errors.array() });
    }
    next();
  }
];

const validateRegister = [
  body('password')
    .exists({ checkFalsy: true })
    .withMessage('密码不能为空')
    .isLength({ min: 8 })
    .withMessage('密码至少8位')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('密码必须包含字母和数字'),
  body('username')
    .if(body('username').exists({ checkFalsy: false }))
    .isLength({ min: 2, max: 50 })
    .withMessage('用户名长度2-50位')
    .trim(),
  body('email')
    .if(body('email').exists({ checkFalsy: false }))
    .isEmail()
    .withMessage('邮箱格式不正确')
    .normalizeEmail(),
  body('phone')
    .if(body('phone').exists({ checkFalsy: false }))
    .isMobilePhone('zh-CN')
    .withMessage('手机号格式不正确'),
  (req, res, next) => {
    const { username, email, phone } = req.body;
    if (!username && !email && !phone) {
      return res.status(400).json({
        message: '用户名、邮箱或手机号至少填写一个',
        errors: [{ msg: '用户名、邮箱或手机号至少填写一个', param: 'account' }]
      });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '输入验证失败', errors: errors.array() });
    }
    next();
  }
];

const validateLoginInput = [
  body('account')
    .exists({ checkFalsy: true })
    .withMessage('账号不能为空')
    .trim(),
  body('password')
    .exists({ checkFalsy: true })
    .withMessage('密码不能为空'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '输入验证失败', errors: errors.array() });
    }
    next();
  }
];

const idParameterGuard = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName] || req.body[paramName] || req.query[paramName];
    if (id !== undefined && id !== null) {
      if (isNaN(parseInt(id))) {
        return res.status(400).json({ message: '无效的ID参数' });
      }
    }
    next();
  };
};

function formatError(error) {
  if (!error) return 'Unknown error';
  if (error.sqlMessage) return error.sqlMessage;
  if (error.message) return error.message;
  if (error.code) return error.code;
  return String(error);
}

module.exports = { xssSanitize, validatePassword, validateRegister, validateLoginInput, idParameterGuard, formatError };

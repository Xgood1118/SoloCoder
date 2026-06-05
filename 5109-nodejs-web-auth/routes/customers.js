const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/auth');
const { xssSanitize, idParameterGuard } = require('../middleware/security');

router.use(authenticateToken);
router.use(idParameterGuard('id'));

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.checkDataPermission, customerController.getCustomerById);
router.post('/', xssSanitize, customerController.createCustomer);
router.put('/:id', xssSanitize, customerController.checkDataPermission, customerController.updateCustomer);
router.delete('/:id', customerController.checkDataPermission, customerController.deleteCustomer);

module.exports = router;

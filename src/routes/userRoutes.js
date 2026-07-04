const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validate');

router.use(protect, authorize('customer'));
router.put('/profile', controller.updateProfile);
router.post('/addresses', controller.addAddress);
router.put('/addresses/:id', validateObjectIdParam, controller.updateAddress);
router.delete('/addresses/:id', validateObjectIdParam, controller.deleteAddress);
router.get('/wallet', controller.wallet);

module.exports = router;

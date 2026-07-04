const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, payWithWallet } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/wallet', payWithWallet);

module.exports = router;

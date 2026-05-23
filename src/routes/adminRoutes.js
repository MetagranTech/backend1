const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
// router.use(authorize('admin')); // Optional: add admin role check

router.get('/stats', getStats);

module.exports = router;

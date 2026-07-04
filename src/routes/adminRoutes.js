const express = require('express');
const router = express.Router();
const { getStats, getProviders, updateProviderStatus, getAllBookings } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validate');

router.use(protect, admin);
router.get('/stats', getStats);
router.get('/providers', getProviders);
router.put('/providers/:id/status', validateObjectIdParam, updateProviderStatus);
router.put('/providers/:id/approve', validateObjectIdParam, (req, res, next) => { req.body.status = 'active'; next(); }, updateProviderStatus);
router.get('/bookings', getAllBookings);

module.exports = router;

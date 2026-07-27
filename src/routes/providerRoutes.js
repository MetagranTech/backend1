const express = require('express');
const router = express.Router();
const {
    updateAvailability, updateLocation, getAvailableJobs, getWalletDetails, requestPayout, updateProfile
} = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('provider'));
router.put('/availability', updateAvailability);
router.put('/location', updateLocation);
router.get('/jobs/available', getAvailableJobs);
router.get('/wallet', getWalletDetails);
router.post('/payout', requestPayout);
router.put('/profile', updateProfile);

module.exports = router;

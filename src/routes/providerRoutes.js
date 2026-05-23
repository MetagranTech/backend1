const express = require('express');
const router = express.Router();
const { updateLocation, getWalletDetails, requestPayout } = require('../controllers/providerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.put('/location', updateLocation);
router.get('/wallet', getWalletDetails);
router.post('/payout', requestPayout);

module.exports = router;

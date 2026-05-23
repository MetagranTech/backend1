const express = require('express');
const router = express.Router();
const { 
    createBooking, 
    getBookings, 
    updateStatus, 
    acceptBooking, 
    arriveAtLocation, 
    startService, 
    completeService,
    cancelBooking
} = require('../controllers/bookingController');
const { getProviderLocation } = require('../controllers/providerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', createBooking);
router.get('/', getBookings);
router.get('/:id/track', getProviderLocation);
router.put('/:id/status', updateStatus);
router.put('/:id/accept', acceptBooking);
router.put('/:id/arrive', arriveAtLocation);
router.put('/:id/start', startService);
router.put('/:id/complete', completeService);
router.put('/:id/cancel', cancelBooking);

module.exports = router;

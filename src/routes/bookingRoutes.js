const express = require('express');
const router = express.Router();
const controller = require('../controllers/bookingController');
const { getProviderLocation } = require('../controllers/providerController');
const { protect, authorize } = require('../middleware/auth');
const { validateBookingInput, validateObjectIdParam } = require('../middleware/validate');

router.use(protect);
router.post('/', authorize('customer'), validateBookingInput, controller.createBooking);
router.get('/', authorize('customer', 'provider'), controller.getBookings);
router.get('/:id', authorize('customer', 'provider'), validateObjectIdParam, controller.getBooking);
router.get('/:id/track', authorize('customer'), validateObjectIdParam, getProviderLocation);
router.put('/:id/accept', authorize('provider'), validateObjectIdParam, controller.acceptBooking);
router.put('/:id/arrive', authorize('provider'), validateObjectIdParam, controller.arriveAtLocation);
router.put('/:id/start', authorize('provider'), validateObjectIdParam, controller.startService);
router.put('/:id/quote', authorize('provider'), validateObjectIdParam, controller.submitQuote);
router.put('/:id/quote/approve', authorize('customer'), validateObjectIdParam, controller.approveQuote);
router.put('/:id/complete', authorize('provider'), validateObjectIdParam, controller.completeService);
router.put('/:id/cancel', authorize('customer', 'provider'), validateObjectIdParam, controller.cancelBooking);
router.post('/:id/rating', authorize('customer'), validateObjectIdParam, controller.rateBooking);

module.exports = router;

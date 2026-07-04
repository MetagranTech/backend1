const express = require('express');
const router = express.Router();
const { raiseComplaint, getMyComplaints, getAllComplaints, resolveComplaint } = require('../controllers/complaintController');
const { protect, authorize, admin } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('customer'), raiseComplaint);
router.get('/', authorize('customer'), getMyComplaints);
router.get('/admin/all', admin, getAllComplaints);
router.put('/admin/:id/resolve', admin, resolveComplaint);

module.exports = router;

const express = require('express');
const router = express.Router();
const { raiseComplaint, getMyComplaints, getAllComplaints, resolveComplaint } = require('../controllers/complaintController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', raiseComplaint);
router.get('/', getMyComplaints);
router.get('/admin/all', getAllComplaints);
router.put('/admin/:id/resolve', resolveComplaint);

module.exports = router;

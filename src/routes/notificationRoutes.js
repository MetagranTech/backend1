const express = require('express');
const router = express.Router();
const {
    getNotifications,
    createAdminNotification,
    postReviewNotification,
    deleteNotification
} = require('../controllers/notificationController');
const { protect, admin } = require('../middleware/auth');

// Public or Protected (depending on requirement, but mobile app needs it)
router.get('/', getNotifications);

// Review notification (triggered by mobile app after order)
router.post('/review', protect, postReviewNotification);

// Admin routes
router.post('/', protect, admin, createAdminNotification);
router.delete('/:id', protect, admin, deleteNotification);

module.exports = router;

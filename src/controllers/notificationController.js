const Notification = require('../models/Notification');
const admin = require('../config/firebase');

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Public
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: notifications.length,
            notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create a notification (Admin)
// @route   POST /api/notifications
// @access  Private/Admin
exports.createAdminNotification = async (req, res) => {
    try {
        const { title, body, type, targetApp } = req.body;

        const notification = await Notification.create({
            title,
            body,
            type: type || 'offer',
            targetApp: targetApp || 'customer'
        });

        // Send Push Notification via FCM
        const message = {
            notification: {
                title: title,
                body: body,
            },
            topic: targetApp === 'service' ? 'service_notifications' : 'customer_notifications',
        };

        if (targetApp === 'both') {
            await admin.messaging().send({ ...message, topic: 'customer_notifications' });
            await admin.messaging().send({ ...message, topic: 'service_notifications' });
        } else {
            await admin.messaging().send(message);
        }

        res.status(201).json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Post a review and trigger notification
// @route   POST /api/notifications/review
// @access  Private
exports.postReviewNotification = async (req, res) => {
    try {
        const { userName, userImage, rating, comment } = req.body;

        const notification = await Notification.create({
            title: `New Review from ${userName}`,
            body: comment,
            type: 'review',
            userName,
            userImage,
            rating,
            targetApp: 'customer'
        });

        // Send Push Notification to all customers
        const message = {
            notification: {
                title: `${userName} gave a ${rating}★ review!`,
                body: comment,
            },
            topic: 'customer_notifications',
        };

        await admin.messaging().send(message);

        res.status(201).json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Post review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private/Admin
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        await notification.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Notification removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

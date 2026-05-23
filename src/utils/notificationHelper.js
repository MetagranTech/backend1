const admin = require('../config/firebase');

/**
 * Send Push Notification to a specific device
 * @param {string} token - FCM device token
 * @param {object} notification - { title, body }
 * @param {object} data - Optional data payload
 */
exports.sendNotification = async (token, notification, data = {}) => {
    if (!token) return;

    const message = {
        notification,
        data,
        token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
        return response;
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

/**
 * Send Push Notification to multiple devices
 * @param {Array} tokens - Array of FCM device tokens
 * @param {object} notification - { title, body }
 */
exports.sendMulticastNotification = async (tokens, notification, data = {}) => {
    if (!tokens || tokens.length === 0) return;

    const message = {
        notification,
        data,
        tokens,
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        console.log(`${response.successCount} notifications were sent successfully`);
        return response;
    } catch (error) {
        console.error('Error sending multicast notification:', error);
    }
};

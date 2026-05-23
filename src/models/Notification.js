const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['review', 'offer', 'update'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    userName: {
        type: String // for reviews
    },
    userImage: {
        type: String // for reviews
    },
    rating: {
        type: Number // for reviews
    },
    targetApp: {
        type: String,
        enum: ['customer', 'service', 'both'],
        default: 'customer'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '60d' } // Auto-delete after 60 days (2 months)
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

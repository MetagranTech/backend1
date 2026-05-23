const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    profilePic: {
        type: String,
        default: ''
    },
    addresses: [{
        label: String, // Home, Work, etc.
        street: String,
        city: String,
        state: String,
        zipCode: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    }],
    walletBalance: {
        type: Number,
        default: 0
    },
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fcmToken: String,
    status: {
        type: String,
        enum: ['active', 'suspended'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

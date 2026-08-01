const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema({
    accountType: { type: String, enum: ['customer', 'provider'], required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    verifiedAt: Date,
    consumedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('EmailOtp', emailOtpSchema);

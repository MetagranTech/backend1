const mongoose = require('mongoose');

const otpChallengeSchema = new mongoose.Schema({
    phone: { type: String, required: true, index: true },
    accountType: { type: String, enum: ['customer', 'provider'], required: true },
    purpose: { type: String, enum: ['login', 'register'], required: true },
    provider: { type: String, enum: ['msg91', 'test'], required: true },
    providerRequestId: { type: String },
    testOtpHash: { type: String, select: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    consumedAt: Date,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

otpChallengeSchema.index({ phone: 1, accountType: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model('OtpChallenge', otpChallengeSchema);

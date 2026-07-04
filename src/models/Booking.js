const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    timeSlot: {
        type: String,
        required: true
    },
    issueDescription: String,
    media: [{
        url: String,
        type: {
            type: String,
            enum: ['image', 'voice']
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'accepted', 'on_the_way', 'arrived', 'started', 'completed', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['online', 'wallet', 'cash']
    },
    pricing: {
        baseAmount: Number,
        inspectionCharge: Number,
        extraPartsAmount: Number,
        gstAmount: Number,
        platformFee: Number,
        totalAmount: Number,
        providerCommission: Number,
        amountPaid: { type: Number, default: 0 },
        quoteStatus: {
            type: String,
            enum: ['not_required', 'pending_customer', 'approved', 'rejected'],
            default: 'not_required'
        }
    },
    otp: String, // For verification at arrival or completion
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpayOrderAmount: Number,
    rating: {
        score: Number,
        comment: String
    },
    completedAt: Date,
    earningsCredited: { type: Boolean, default: false, select: false },
    cancelledAt: Date,
    cancellationReason: String
}, { timestamps: true });

bookingSchema.index({ status: 1, service: 1, scheduledDate: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);

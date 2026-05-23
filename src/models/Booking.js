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
        providerCommission: Number
    },
    otp: String, // For verification at arrival or completion
    razorpayOrderId: String,
    razorpayPaymentId: String,
    rating: {
        score: Number,
        comment: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);

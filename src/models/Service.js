const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: String,
    iconUrl: String,
    imageUrl: String,
    category: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 80
    },
    basePrice: {
        type: Number,
        required: true
    },
    pricingType: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: 2,
        maxlength: 40,
        default: 'inspection'
    },
    gstPercentage: {
        type: Number,
        default: 18
    },
    platformFee: {
        type: Number,
        default: 50
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);

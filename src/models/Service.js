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
        enum: ['Electrician', 'Plumbing', 'AC Repair', 'Fridge Repair', 'Washing Machine Repair', 'Tank Cleaning', 'Bathroom Cleaning', 'Home Cleaning']
    },
    basePrice: {
        type: Number,
        required: true
    },
    pricingType: {
        type: String,
        enum: ['fixed', 'inspection'],
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

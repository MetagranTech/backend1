const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: {
        type: String,
        enum: ['booking', 'payment', 'general', 'technician'],
        default: 'general'
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('FAQ', faqSchema);

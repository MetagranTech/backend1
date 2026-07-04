const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    }
}, { timestamps: true });

transactionSchema.index(
    { booking: 1, type: 1 },
    { unique: true, partialFilterExpression: { booking: { $type: 'objectId' }, type: 'credit' } }
);

module.exports = mongoose.model('Transaction', transactionSchema);

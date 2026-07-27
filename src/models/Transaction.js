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
    payoutMethod: {
        type: String,
        enum: ['upi', 'bank']
    },
    payoutDetails: {
        upiId: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String
    },
    weekStart: Date,
    weekEnd: Date,
    processedAt: Date,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
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
transactionSchema.index(
    { provider: 1, weekStart: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: {
            weekStart: { $type: 'date' },
            type: 'debit',
            status: { $in: ['pending', 'completed'] }
        }
    }
);

module.exports = mongoose.model('Transaction', transactionSchema);

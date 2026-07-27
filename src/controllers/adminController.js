const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendNotification } = require('../utils/notificationHelper');

exports.getStats = async (req, res) => {
    const [totalBookings, activeProviders, totalCustomers, revenueData, dailyRevenue] = await Promise.all([
        Booking.countDocuments(),
        Provider.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'active' }),
        Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }]),
        Booking.aggregate([
            { $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$pricing.totalAmount' } } },
            { $sort: { _id: 1 } }
        ])
    ]);
    res.json({
        success: true,
        stats: { totalBookings, activeProviders, totalCustomers, totalRevenue: revenueData[0]?.total || 0 },
        dailyRevenue
    });
};

exports.getProviders = async (req, res) => {
    const query = req.query.status ? { status: req.query.status } : {};
    const providers = await Provider.find(query).sort('-createdAt');
    res.json({ success: true, providers });
};

exports.updateProviderStatus = async (req, res) => {
    const { status, rejectionReason } = req.body;
    if (!['active', 'pending', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid provider status' });
    }
    const existingProvider = await Provider.findById(req.params.id).select('status fcmToken');
    if (!existingProvider) return res.status(404).json({ success: false, message: 'Provider not found' });

    const update = { status };
    if (status === 'active') update['kycDetails.status'] = 'approved';
    if (status === 'pending' && rejectionReason) {
        update['kycDetails.status'] = 'rejected';
        update['kycDetails.rejectionReason'] = rejectionReason;
    }
    const provider = await Provider.findByIdAndUpdate(req.params.id, update, { new: true });
    if (status === 'active' && existingProvider.status !== 'active') {
        await sendNotification(existingProvider.fcmToken, {
            title: 'Provider request approved',
            body: 'Your request to work as a provider in the Service Man App has been approved.'
        }, {
            type: 'provider_approved',
            providerId: provider._id.toString()
        });
    }
    res.json({ success: true, provider });
};

exports.getAllBookings = async (req, res) => {
    const query = req.query.status ? { status: req.query.status } : {};
    const bookings = await Booking.find(query)
        .populate('service').populate('customer', 'name phone').populate('provider', 'name phone')
        .sort('-createdAt');
    res.json({ success: true, bookings });
};

exports.getPayouts = async (req, res) => {
    const query = { type: 'debit' };
    if (req.query.status) query.status = req.query.status;
    const payouts = await Transaction.find(query)
        .populate('provider', 'name phone email bankDetails')
        .sort('-createdAt');
    const pendingTotal = payouts
        .filter((payout) => payout.status === 'pending')
        .reduce((total, payout) => total + Number(payout.amount || 0), 0);
    res.json({ success: true, pendingTotal, payouts });
};

exports.updatePayoutStatus = async (req, res) => {
    const status = req.body.status;
    if (!['completed', 'failed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Payout status must be completed or failed' });
    }
    const payout = await Transaction.findOneAndUpdate(
        { _id: req.params.id, type: 'debit', status: 'pending' },
        { status, processedAt: new Date(), processedBy: req.user._id },
        { new: true }
    ).populate('provider', 'name phone email bankDetails');
    if (!payout) {
        return res.status(409).json({ success: false, message: 'Only a pending payout can be updated' });
    }
    if (status === 'failed') {
        await Provider.findByIdAndUpdate(payout.provider._id, { $inc: { walletBalance: payout.amount } });
    }
    res.json({ success: true, payout });
};

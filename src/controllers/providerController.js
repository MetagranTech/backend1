const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { isProviderEligibleForBookingRequest } = require('../utils/serviceArea');
const { isBookingRequestPast } = require('../utils/bookingSchedule');
const { getCurrentPayoutWeek, getNextSundayInIndia, isSundayInIndia } = require('../utils/payoutWeek');

exports.updateAvailability = async (req, res) => {
    req.user.isOnline = Boolean(req.body.isOnline);
    await req.user.save();
    res.json({ success: true, isOnline: req.user.isOnline });
};

exports.updateLocation = async (req, res) => {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }
    await Provider.findByIdAndUpdate(req.user._id, { lastLocation: { lat, lng }, lastLocationUpdate: new Date() });
    res.json({ success: true });
};

exports.getAvailableJobs = async (req, res) => {
    if (!req.user.isOnline || req.user.status !== 'active') {
        return res.json({ success: true, bookings: [] });
    }
    const services = await require('../models/Service').find({ category: { $in: req.user.categories }, isActive: true }).select('_id');
    const candidates = await Booking.find({ status: 'pending', provider: null, service: { $in: services.map((s) => s._id) } })
        .populate('service').populate('customer', 'name').sort({ scheduledDate: 1 }).limit(500);
    const bookings = candidates
        .filter((booking) => !isBookingRequestPast(booking))
        .filter((booking) => isProviderEligibleForBookingRequest(req.user.serviceArea, booking.address))
        .slice(0, 100);
    res.json({ success: true, bookings });
};

exports.getProviderLocation = async (req, res) => {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id })
        .populate('provider', 'lastLocation lastLocationUpdate name phone profilePic');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.provider) return res.status(409).json({ success: false, message: 'Provider not yet assigned' });
    res.json({
        success: true,
        location: booking.provider.lastLocation,
        updatedAt: booking.provider.lastLocationUpdate,
        provider: booking.provider
    });
};

exports.getWalletDetails = async (req, res) => {
    const { start, end } = getCurrentPayoutWeek();
    const [provider, transactions, weeklyJobs] = await Promise.all([
        Provider.findById(req.user._id).select('walletBalance bankDetails'),
        Transaction.find({ provider: req.user._id }).sort('-createdAt').limit(100)
            .populate('booking', 'bookingId service completedAt'),
        Booking.aggregate([
            {
                $match: {
                    provider: req.user._id,
                    status: 'completed',
                    completedAt: { $gte: start, $lt: end }
                }
            },
            {
                $group: {
                    _id: null,
                    jobs: { $sum: 1 },
                    basePriceTotal: { $sum: { $ifNull: ['$pricing.baseAmount', 0] } }
                }
            }
        ])
    ]);
    res.json({
        success: true,
        balance: Number(provider?.walletBalance || 0),
        weeklyEarnings: Number(weeklyJobs[0]?.basePriceTotal || 0),
        weeklyCompletedJobs: Number(weeklyJobs[0]?.jobs || 0),
        weekStart: start,
        weekEnd: end,
        withdrawalEnabled: isSundayInIndia(),
        nextWithdrawalDate: getNextSundayInIndia(),
        bankDetails: provider?.bankDetails || {},
        transactions
    });
};

exports.requestPayout = async (req, res) => {
    if (!isSundayInIndia()) {
        return res.status(403).json({ success: false, message: 'Weekly withdrawal requests are available only on Sunday' });
    }
    const providerDetails = await Provider.findById(req.user._id).select('walletBalance bankDetails');
    if (!providerDetails) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    const details = providerDetails?.bankDetails || {};
    const method = details.payoutMethod;
    const hasUpi = method === 'upi' && /^[\w.-]{2,256}@[A-Za-z]{2,64}$/.test(details.upiId || '');
    const hasBank = method === 'bank'
        && details.accountHolderName && details.accountNumber && details.ifscCode && details.bankName;
    if (!hasUpi && !hasBank) {
        return res.status(400).json({ success: false, message: 'Add valid UPI or bank transfer details before requesting payout' });
    }
    const amount = Number(providerDetails.walletBalance || 0);
    if (amount <= 0) {
        return res.status(400).json({ success: false, message: 'No available balance to withdraw' });
    }
    const { start, end } = getCurrentPayoutWeek();
    const existing = await Transaction.findOne({
        provider: req.user._id, type: 'debit', weekStart: start, status: { $in: ['pending', 'completed'] }
    });
    if (existing) {
        return res.status(409).json({ success: false, message: 'This week payout was already requested' });
    }
    const provider = await Provider.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
    );
    if (!provider) return res.status(400).json({ success: false, message: 'Insufficient balance' });
    let transaction;
    try {
        transaction = await Transaction.create({
            provider: req.user._id,
            type: 'debit',
            amount,
            description: 'Weekly payout request',
            status: 'pending',
            payoutMethod: method,
            payoutDetails: {
                upiId: details.upiId,
                accountHolderName: details.accountHolderName,
                accountNumber: details.accountNumber,
                ifscCode: details.ifscCode,
                bankName: details.bankName
            },
            weekStart: start,
            weekEnd: end
        });
    } catch (error) {
        await Provider.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: amount } });
        throw error;
    }
    res.status(201).json({ success: true, message: 'Payout requested', balance: provider.walletBalance, transaction });
};

exports.updateProfile = async (req, res) => {
    const allowed = ['name', 'email', 'categories', 'skills', 'experience', 'bankDetails', 'serviceArea', 'profilePic'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (update.bankDetails) {
        const details = update.bankDetails;
        if (details.payoutMethod === 'upi') {
            const upiId = String(details.upiId || '').trim();
            if (!/^[\w.-]{2,256}@[A-Za-z]{2,64}$/.test(upiId)) {
                return res.status(400).json({ success: false, message: 'Enter a valid UPI ID' });
            }
            update.bankDetails = { payoutMethod: 'upi', upiId };
        } else if (details.payoutMethod === 'bank') {
            const bank = {
                payoutMethod: 'bank',
                accountHolderName: String(details.accountHolderName || '').trim(),
                accountNumber: String(details.accountNumber || '').replace(/\s/g, ''),
                ifscCode: String(details.ifscCode || '').trim().toUpperCase(),
                bankName: String(details.bankName || '').trim()
            };
            if (!bank.accountHolderName || !/^\d{6,20}$/.test(bank.accountNumber)
                || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifscCode) || !bank.bankName) {
                return res.status(400).json({ success: false, message: 'Enter valid bank transfer details' });
            }
            update.bankDetails = bank;
        } else {
            return res.status(400).json({ success: false, message: 'Choose UPI or bank transfer' });
        }
    }
    const provider = await Provider.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, provider });
};

const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { isAddressWithinServiceArea } = require('../utils/serviceArea');

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
    const services = await require('../models/Service').find({ category: { $in: req.user.categories }, isActive: true }).select('_id');
    const candidates = await Booking.find({ status: 'pending', provider: null, service: { $in: services.map((s) => s._id) } })
        .populate('service').populate('customer', 'name').sort({ scheduledDate: 1 }).limit(500);
    const bookings = candidates
        .filter((booking) => isAddressWithinServiceArea(req.user.serviceArea, booking.address))
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
    const [provider, transactions] = await Promise.all([
        Provider.findById(req.user._id).select('walletBalance'),
        Transaction.find({ provider: req.user._id }).sort('-createdAt').limit(100)
    ]);
    res.json({ success: true, balance: provider.walletBalance, transactions });
};

exports.requestPayout = async (req, res) => {
    const amount = Number(req.body.amount);
    const provider = await Provider.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
    );
    if (!provider) return res.status(400).json({ success: false, message: 'Insufficient balance' });
    const transaction = await Transaction.create({
        provider: req.user._id, type: 'debit', amount, description: 'Payout request', status: 'pending'
    });
    res.status(201).json({ success: true, message: 'Payout requested', balance: provider.walletBalance, transaction });
};

exports.updateProfile = async (req, res) => {
    const allowed = ['name', 'email', 'categories', 'skills', 'experience', 'bankDetails', 'serviceArea', 'profilePic'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const provider = await Provider.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, provider });
};

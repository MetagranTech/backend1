const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const User = require('../models/User');

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
    const update = { status };
    if (status === 'active') update['kycDetails.status'] = 'approved';
    if (status === 'pending' && rejectionReason) {
        update['kycDetails.status'] = 'rejected';
        update['kycDetails.rejectionReason'] = rejectionReason;
    }
    const provider = await Provider.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.json({ success: true, provider });
};

exports.getAllBookings = async (req, res) => {
    const query = req.query.status ? { status: req.query.status } : {};
    const bookings = await Booking.find(query)
        .populate('service').populate('customer', 'name phone').populate('provider', 'name phone')
        .sort('-createdAt');
    res.json({ success: true, bookings });
};

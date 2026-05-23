const Booking = require('../models/Booking');
const Provider = require('../models/Provider');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
exports.getStats = async (req, res) => {
    try {
        const totalBookings = await Booking.countDocuments();
        const activeProviders = await Provider.countDocuments({ status: 'active' });
        
        // Aggregate total revenue from completed bookings
        const revenueData = await Booking.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
        ]);

        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // Daily revenue for the last 7 days
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyRevenue = await Booking.aggregate([
            { $match: { paymentStatus: 'paid', createdAt: { $gte: last7Days } } },
            { 
                $group: { 
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                    revenue: { $sum: "$pricing.totalAmount" } 
                } 
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalBookings,
                activeProviders,
                totalRevenue
            },
            dailyRevenue
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

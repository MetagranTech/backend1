const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

// @desc    Update Provider Location
// @route   PUT /api/providers/location
// @access  Private (Provider)
exports.updateLocation = async (req, res) => {
    const { lat, lng } = req.body;

    try {
        await Provider.findByIdAndUpdate(req.user._id, {
            lastLocation: { lat, lng },
            lastLocationUpdate: Date.now()
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Provider Location for Customer
// @route   GET /api/bookings/:id/track
// @access  Private (Customer)
exports.getProviderLocation = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('provider', 'lastLocation lastLocationUpdate name phone');
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (!booking.provider) {
            return res.status(400).json({ success: false, message: 'Provider not yet assigned' });
        }

        res.status(200).json({ 
            success: true, 
            location: booking.provider.lastLocation,
            updatedAt: booking.provider.lastLocationUpdate,
            provider: {
                name: booking.provider.name,
                phone: booking.provider.phone
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Earnings and Wallet History
// @route   GET /api/providers/wallet
// @access  Private (Provider)
exports.getWalletDetails = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        const transactions = await Transaction.find({ provider: req.user._id }).sort('-createdAt');

        res.status(200).json({
            success: true,
            balance: provider.walletBalance,
            transactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Process Payout (Simulated)
// @route   POST /api/providers/payout
// @access  Private (Provider)
exports.requestPayout = async (req, res) => {
    const { amount } = req.body;

    try {
        const provider = await Provider.findById(req.user._id);

        if (provider.walletBalance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        // Logic for payout transfer would go here

        provider.walletBalance -= amount;
        await provider.save();

        await Transaction.create({
            provider: req.user._id,
            type: 'debit',
            amount,
            description: 'Weekly payout request'
        });

        res.status(200).json({ success: true, message: 'Payout requested successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

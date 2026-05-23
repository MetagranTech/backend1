const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const User = require('../models/User');
const { sendNotification, sendMulticastNotification } = require('../utils/notificationHelper');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private (Customer)
exports.createBooking = async (req, res) => {
    try {
        const { serviceId, address, scheduledDate, timeSlot, issueDescription, media } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        // Generate a unique Booking ID
        const bookingId = 'HSI' + Math.floor(100000 + Math.random() * 900000);

        const booking = await Booking.create({
            bookingId,
            customer: req.user._id,
            service: serviceId,
            address,
            scheduledDate,
            timeSlot,
            issueDescription,
            media,
            pricing: {
                baseAmount: service.basePrice,
                inspectionCharge: service.pricingType === 'inspection' ? service.basePrice : 0,
                gstAmount: (service.basePrice * service.gstPercentage) / 100,
                platformFee: service.platformFee,
                totalAmount: service.basePrice + ((service.basePrice * service.gstPercentage) / 100) + service.platformFee
            }
        });

        // Notify nearby providers
        const nearbyProviders = await Provider.find({
            status: 'active',
            isOnline: true,
            categories: service.category
        }).select('fcmToken');

        const tokens = nearbyProviders.map(p => p.fcmToken).filter(t => t);
        await sendMulticastNotification(tokens, {
            title: 'New Booking Available!',
            body: `A new ${service.name} job is available near you.`
        }, { bookingId: booking._id.toString() });

        res.status(201).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all bookings for a user/provider
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res) => {
    try {
        let query = {};
        if (req.user.constructor.modelName === 'User') {
            query.customer = req.user._id;
        } else {
            query.provider = req.user._id;
        }

        const bookings = await Booking.find(query)
            .populate('service')
            .populate('customer', 'name phone')
            .populate('provider', 'name phone profilePic')
            .sort('-createdAt');

        res.status(200).json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private (Provider/Customer)
exports.updateStatus = async (req, res) => {
    try {
        const { status, otp } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Add logic for status transitions and OTP verification
        if (status === 'started' && booking.otp !== otp) {
             // return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        booking.status = status;
        await booking.save();

        res.status(200).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Accept a booking
// @route   PUT /api/bookings/:id/accept
// @access  Private (Provider)
exports.acceptBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Booking already accepted or cancelled' });
        }

        booking.provider = req.user._id;
        booking.status = 'accepted';
        // Generate OTP for service start
        booking.otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        await booking.save();

        res.status(200).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Technician arrived at location
// @route   PUT /api/bookings/:id/arrive
// @access  Private (Provider)
exports.arriveAtLocation = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        booking.status = 'arrived';
        await booking.save();

        // Notify Customer
        const customer = await User.findById(booking.customer).select('fcmToken');
        if (customer?.fcmToken) {
            await sendNotification(customer.fcmToken, {
                title: 'Technician Arrived',
                body: 'Your technician has reached your location.'
            });
        }

        res.status(200).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Start service with OTP verification
// @route   PUT /api/bookings/:id/start
// @access  Private (Provider)
exports.startService = async (req, res) => {
    const { otp } = req.body;

    try {
        const booking = await Booking.findById(req.params.id);
        if (booking.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please ask the customer for the correct code.' });
        }

        booking.status = 'started';
        await booking.save();

        res.status(200).json({ success: true, message: 'Service started successfully', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Complete service
// @route   PUT /api/bookings/:id/complete
// @access  Private (Provider)
exports.completeService = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('service');
        
        booking.status = 'completed';
        await booking.save();

        // Calculate earnings (e.g., 80% to provider, 20% commission)
        const totalAmount = booking.pricing.totalAmount;
        const providerEarnings = totalAmount * 0.8;

        const provider = await Provider.findById(booking.provider);
        provider.walletBalance += providerEarnings;
        await provider.save();

        // Record Transaction
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            provider: provider._id,
            booking: booking._id,
            type: 'credit',
            amount: providerEarnings,
            description: `Earnings for ${booking.service.name}`
        });

        res.status(200).json({ success: true, message: 'Service completed and earnings added to wallet', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (Customer/Provider)
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.status === 'completed' || booking.status === 'started') {
            return res.status(400).json({ success: false, message: 'Cannot cancel a started or completed service' });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.status(200).json({ success: true, message: 'Booking cancelled successfully', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const crypto = require('crypto');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { sendNotification, sendMulticastNotification } = require('../utils/notificationHelper');
const { isAddressWithinServiceArea, isProviderEligibleForBookingRequest } = require('../utils/serviceArea');
const { isBookingRequestPast } = require('../utils/bookingSchedule');

const totalPricing = (service, baseAmount, extraPartsAmount = 0) => {
    const taxable = Number(baseAmount) + Number(extraPartsAmount);
    const gstAmount = Number((taxable * service.gstPercentage / 100).toFixed(2));
    const platformFee = Number(service.platformFee);
    return {
        baseAmount: Number(baseAmount),
        inspectionCharge: service.pricingType === 'inspection' ? Number(service.basePrice) : 0,
        extraPartsAmount: Number(extraPartsAmount),
        gstAmount,
        platformFee,
        totalAmount: Number((taxable + gstAmount + platformFee).toFixed(2)),
        providerCommission: 20,
        amountPaid: 0,
        quoteStatus: service.pricingType === 'inspection' ? 'pending_customer' : 'not_required'
    };
};

exports.createBooking = async (req, res) => {
    const { serviceId, address, scheduledDate, timeSlot, issueDescription, media, paymentMethod } = req.body;
    const service = await Service.findOne({ _id: serviceId, isActive: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found or inactive' });

    const pricing = totalPricing(service, service.basePrice);
    if (service.pricingType === 'inspection') pricing.quoteStatus = 'not_required';
    const booking = await Booking.create({
        bookingId: `HSI${Date.now().toString(36).toUpperCase()}${crypto.randomInt(100, 999)}`,
        customer: req.user._id,
        service: serviceId,
        address,
        scheduledDate,
        timeSlot,
        issueDescription: issueDescription?.trim(),
        media: Array.isArray(media) ? media.slice(0, 6) : [],
        paymentMethod: ['online', 'wallet', 'cash'].includes(paymentMethod) ? paymentMethod : 'online',
        pricing
    });

    const eligibleProviders = await Provider.find({
        status: 'active', isOnline: true, categories: service.category, fcmToken: { $exists: true, $ne: '' }
    }).select('fcmToken serviceArea');
    const nearbyProviders = eligibleProviders.filter((provider) =>
        isProviderEligibleForBookingRequest(provider.serviceArea, booking.address)
    );
    await sendMulticastNotification(nearbyProviders.map((p) => p.fcmToken), {
        title: 'New booking available', body: `${service.name} job is available.`
    }, { bookingId: booking._id.toString() });
    res.status(201).json({ success: true, booking: await booking.populate('service') });
};

exports.getBookings = async (req, res) => {
    const query = req.authType === 'customer' ? { customer: req.user._id } : { provider: req.user._id };
    const bookings = await Booking.find(query)
        .select(req.authType === 'provider' ? '-otp' : '')
        .populate('service').populate('customer', 'name phone').populate('provider', 'name phone profilePic')
        .sort('-createdAt');
    res.json({ success: true, bookings });
};

exports.getBooking = async (req, res) => {
    const ownership = req.authType === 'customer' ? { customer: req.user._id } : { provider: req.user._id };
    let booking = await Booking.findOne({ _id: req.params.id, ...ownership })
        .select(req.authType === 'provider' ? '-otp' : '')
        .populate('service').populate('customer', 'name phone').populate('provider', 'name phone profilePic');
    if (!booking && req.authType === 'provider' && req.user.isOnline && req.user.status === 'active') {
        const candidate = await Booking.findOne({ _id: req.params.id, status: 'pending', provider: null })
            .select('-otp')
            .populate('service').populate('customer', 'name phone').populate('provider', 'name phone profilePic');
        if (candidate?.service && !isBookingRequestPast(candidate)
            && req.user.categories.includes(candidate.service.category)
            && isProviderEligibleForBookingRequest(req.user.serviceArea, candidate.address)) {
            booking = candidate;
        }
    }
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, booking });
};

exports.acceptBooking = async (req, res) => {
    if (!req.user.isOnline || req.user.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Provider must be approved and online' });
    }
    const candidate = await Booking.findById(req.params.id).populate('service');
    if (!candidate || !candidate.service || !req.user.categories.includes(candidate.service.category)) {
        return res.status(404).json({ success: false, message: 'Eligible booking not found' });
    }
    if (isBookingRequestPast(candidate)) {
        return res.status(409).json({ success: false, message: 'This booking request has expired' });
    }
    if (!isAddressWithinServiceArea(req.user.serviceArea, candidate.address)) {
        return res.status(403).json({ success: false, message: 'Booking is outside your service radius' });
    }
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, status: 'pending', provider: null },
        { provider: req.user._id, status: 'accepted', otp: crypto.randomInt(1000, 10000).toString() },
        { new: true }
    ).select('-otp').populate('service customer');
    if (!booking) return res.status(409).json({ success: false, message: 'Booking was already accepted' });
    const customer = await User.findById(booking.customer).select('fcmToken');
    await sendNotification(customer?.fcmToken, { title: 'Technician assigned', body: `${req.user.name} accepted your booking.` }, { bookingId: booking._id.toString() });
    res.json({ success: true, booking });
};

const providerTransition = (from, to) => async (req, res) => {
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, provider: req.user._id, status: from },
        { status: to }, { new: true }
    ).select('-otp');
    if (!booking) return res.status(409).json({ success: false, message: `Booking must be ${from} before this action` });
    res.json({ success: true, booking });
};

exports.arriveAtLocation = providerTransition('accepted', 'arrived');

exports.startService = async (req, res) => {
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, provider: req.user._id, status: 'arrived', otp: String(req.body.otp || '') },
        { status: 'started' }, { new: true }
    ).select('-otp');
    if (!booking) return res.status(400).json({ success: false, message: 'Invalid OTP or booking state' });
    res.json({ success: true, booking });
};

exports.submitQuote = async (req, res) => {
    const baseAmount = Number(req.body.baseAmount);
    const extraPartsAmount = Number(req.body.extraPartsAmount || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !Number.isFinite(extraPartsAmount) || extraPartsAmount < 0) {
        return res.status(400).json({ success: false, message: 'Valid quote amounts are required' });
    }
    const booking = await Booking.findOne({ _id: req.params.id, provider: req.user._id, status: { $in: ['arrived', 'started'] } }).populate('service');
    if (!booking || booking.service.pricingType !== 'inspection') {
        return res.status(409).json({ success: false, message: 'Inspection quote is not available for this booking' });
    }
    const alreadyPaid = Number(booking.pricing?.amountPaid || 0);
    booking.pricing = totalPricing(booking.service, baseAmount, extraPartsAmount);
    booking.pricing.amountPaid = alreadyPaid;
    booking.pricing.quoteStatus = 'pending_customer';
    if (alreadyPaid < booking.pricing.totalAmount) {
        booking.paymentStatus = 'pending';
        booking.razorpayOrderId = undefined;
        booking.razorpayOrderAmount = undefined;
    }
    await booking.save();
    res.json({ success: true, booking });
};

exports.approveQuote = async (req, res) => {
    const status = req.body.approved ? 'approved' : 'rejected';
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, customer: req.user._id, 'pricing.quoteStatus': 'pending_customer' },
        { 'pricing.quoteStatus': status }, { new: true }
    );
    if (!booking) return res.status(409).json({ success: false, message: 'No quote is awaiting approval' });
    res.json({ success: true, booking });
};

exports.completeService = async (req, res) => {
    const current = await Booking.findOne({ _id: req.params.id, provider: req.user._id, status: 'started' }).select('+earningsCredited').populate('service');
    if (!current) return res.status(409).json({ success: false, message: 'Only a started booking can be completed' });
    if (current.pricing.quoteStatus === 'pending_customer' || current.pricing.quoteStatus === 'rejected') {
        return res.status(409).json({ success: false, message: 'Customer must approve the inspection quote' });
    }
    if (current.paymentMethod === 'online' && current.paymentStatus !== 'paid') {
        return res.status(402).json({ success: false, message: 'Online payment is not completed' });
    }
    const booking = await Booking.findOneAndUpdate(
        { _id: current._id, status: 'started', earningsCredited: false },
        { status: 'completed', completedAt: new Date(), earningsCredited: true }, { new: true }
    ).populate('service');
    if (!booking) return res.status(409).json({ success: false, message: 'Booking already completed' });

    // Providers earn only the service base price. GST and platform fees stay
    // outside the provider wallet and are reconciled by the platform.
    const providerEarnings = Number(Number(booking.pricing.baseAmount || 0).toFixed(2));
    await Provider.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: providerEarnings } });
    await Transaction.create({
        provider: req.user._id, booking: booking._id, type: 'credit', amount: providerEarnings,
        description: `Earnings for ${booking.service.name}`
    });
    res.json({ success: true, message: 'Service completed', booking, providerEarnings });
};

exports.cancelBooking = async (req, res) => {
    const ownership = req.authType === 'customer' ? { customer: req.user._id } : { provider: req.user._id };
    const allowed = req.authType === 'customer' ? ['pending', 'accepted'] : ['accepted'];
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, ...ownership, status: { $in: allowed } },
        { status: 'cancelled', cancelledAt: new Date(), cancellationReason: req.body.reason?.trim() },
        { new: true }
    );
    if (!booking) return res.status(409).json({ success: false, message: 'Booking cannot be cancelled in its current state' });
    res.json({ success: true, booking });
};

exports.rateBooking = async (req, res) => {
    const score = Number(req.body.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ success: false, message: 'Rating must be from 1 to 5' });
    const booking = await Booking.findOneAndUpdate(
        { _id: req.params.id, customer: req.user._id, status: 'completed', 'rating.score': { $exists: false } },
        { rating: { score, comment: req.body.comment?.trim() } }, { new: true }
    );
    if (!booking) return res.status(409).json({ success: false, message: 'Booking cannot be rated' });
    const ratings = await Booking.aggregate([{ $match: { provider: booking.provider, 'rating.score': { $exists: true } } }, { $group: { _id: null, average: { $avg: '$rating.score' }, count: { $sum: 1 } } }]);
    const provider = await Provider.findByIdAndUpdate(
        booking.provider,
        { rating: ratings[0]?.average || 0, totalRatings: ratings[0]?.count || 0 },
        { new: true }
    ).select('name fcmToken');
    const customerName = req.user.name?.trim() || 'A customer';
    const comment = req.body.comment?.trim();
    const title = `New ${score}★ rating`;
    const body = comment
        ? `${customerName}: ${comment}`
        : `${customerName} rated your completed service ${score} stars.`;
    await Notification.create({
        type: 'review',
        title,
        body,
        userName: customerName,
        rating: score,
        targetApp: 'service',
        recipientProvider: booking.provider,
        booking: booking._id
    });
    await sendNotification(provider?.fcmToken, { title, body }, {
        type: 'provider_rating',
        bookingId: booking._id.toString(),
        rating: String(score)
    });
    res.json({ success: true, booking });
};

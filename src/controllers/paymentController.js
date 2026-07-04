const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');

const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const secureEqual = (a, b) => {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

exports.createOrder = async (req, res) => {
    const booking = await Booking.findOne({
        $or: [{ _id: /^[a-f\d]{24}$/i.test(req.body.bookingId || '') ? req.body.bookingId : null }, { bookingId: req.body.bookingId }],
        customer: req.user._id,
        paymentStatus: 'pending',
        status: { $nin: ['cancelled', 'completed'] }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Payable booking not found' });

    if (booking.razorpayOrderId) {
        const order = await razorpay.orders.fetch(booking.razorpayOrderId);
        return res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
    }
    const outstanding = Number(booking.pricing.totalAmount) - Number(booking.pricing.amountPaid || 0);
    const amount = Math.round(outstanding * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ success: false, message: 'Invalid booking total' });
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: booking.bookingId, notes: { booking: booking._id.toString() } });
    booking.razorpayOrderId = order.id;
    booking.razorpayOrderAmount = amount;
    booking.paymentMethod = 'online';
    await booking.save();
    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
};

exports.verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!secureEqual(razorpay_signature, expected)) return res.status(400).json({ success: false, message: 'Invalid payment signature' });

    const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id, customer: req.user._id, paymentStatus: 'pending' });
    if (!booking) return res.status(409).json({ success: false, message: 'Payment order does not match this customer or is already processed' });
    const amountPaid = Number(booking.pricing.amountPaid || 0) + Number(booking.razorpayOrderAmount || 0) / 100;
    booking.pricing.amountPaid = amountPaid;
    booking.paymentStatus = amountPaid >= Number(booking.pricing.totalAmount) ? 'paid' : 'pending';
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();
    res.json({ success: true, message: 'Payment verified', booking });
};

exports.payWithWallet = async (req, res) => {
    const booking = await Booking.findOne({
        $or: [{ _id: /^[a-f\d]{24}$/i.test(req.body.bookingId || '') ? req.body.bookingId : null }, { bookingId: req.body.bookingId }],
        customer: req.user._id, paymentStatus: 'pending', status: { $nin: ['cancelled', 'completed'] }
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Payable booking not found' });
    const User = require('../models/User');
    const user = await User.findOneAndUpdate(
        { _id: req.user._id, walletBalance: { $gte: booking.pricing.totalAmount } },
        { $inc: { walletBalance: -booking.pricing.totalAmount } }, { new: true }
    );
    if (!user) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    booking.paymentMethod = 'wallet';
    booking.paymentStatus = 'paid';
    await booking.save();
    res.json({ success: true, booking, balance: user.walletBalance });
};

exports.webhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '').update(req.body).digest('hex');
    if (!process.env.RAZORPAY_WEBHOOK_SECRET || !secureEqual(signature, expected)) return res.status(401).send('Invalid signature');
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured') {
        const payment = event.payload.payment.entity;
        const booking = await Booking.findOne({ razorpayOrderId: payment.order_id, paymentStatus: 'pending' });
        if (booking) {
            booking.pricing.amountPaid = Number(booking.pricing.amountPaid || 0) + Number(payment.amount) / 100;
            booking.paymentStatus = booking.pricing.amountPaid >= Number(booking.pricing.totalAmount) ? 'paid' : 'pending';
            booking.razorpayPaymentId = payment.id;
            await booking.save();
        }
    } else if (event.event === 'payment.failed') {
        const payment = event.payload.payment.entity;
        await Booking.findOneAndUpdate({ razorpayOrderId: payment.order_id, paymentStatus: 'pending' }, { paymentStatus: 'failed' });
    }
    res.json({ received: true });
};

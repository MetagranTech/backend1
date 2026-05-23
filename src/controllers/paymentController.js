const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order
// @route   POST /api/payments/create-order
// @access  Private
exports.createOrder = async (req, res) => {
    const { bookingId, amount } = req.body;

    try {
        const options = {
            amount: amount * 100, // Amount in paise
            currency: 'INR',
            receipt: bookingId,
        };

        const order = await razorpay.orders.create(options);

        // Update booking with Razorpay Order ID
        await Booking.findOneAndUpdate({ bookingId }, { razorpayOrderId: order.id });

        res.status(200).json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify Payment Signature
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        // Payment success
        await Booking.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { 
                paymentStatus: 'paid',
                razorpayPaymentId: razorpay_payment_id
            }
        );

        return res.status(200).json({ success: true, message: "Payment verified successfully" });
    } else {
        return res.status(400).json({ success: false, message: "Invalid signature" });
    }
};

const FAQ = require('../models/FAQ');

exports.getAllFaqs = async (req, res) => {
    try {
        const faqs = await FAQ.find({ isActive: true });
        res.status(200).json({ success: true, faqs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createFaq = async (req, res) => {
    try {
        const faq = await FAQ.create(req.body);
        res.status(201).json({ success: true, faq });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.seedFaqs = async () => {
    const count = await FAQ.countDocuments();
    if (count > 0) return;

    await FAQ.insertMany([
        { question: 'How do I book a service?', answer: 'Go to Home, select a service category, choose a sub-service, and fill in the booking details.', category: 'booking' },
        { question: 'What payment methods are accepted?', answer: 'We accept UPI, Debit/Credit cards, Net Banking, and Wallets via Razorpay.', category: 'payment' },
        { question: 'Can I cancel my booking?', answer: 'Yes, you can cancel up to 1 hour before the scheduled time from the Bookings tab.', category: 'booking' },
        { question: 'How is the technician selected?', answer: 'Our system automatically assigns the nearest available and verified technician in your area.', category: 'general' },
        { question: 'Is there a warranty on services?', answer: 'Yes, all services come with a 30-day service warranty on labor.', category: 'general' },
    ]);
    console.log('FAQs seeded successfully');
};

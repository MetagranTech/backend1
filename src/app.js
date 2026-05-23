const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (if any)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/providers', require('./routes/providerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// FAQ Routes (inline for simplicity)
const FAQ = require('./models/FAQ');
app.get('/api/faqs', async (req, res) => {
    const faqs = await FAQ.find({ isActive: true });
    res.json({ success: true, faqs });
});
app.post('/api/faqs', async (req, res) => {
    const faq = await FAQ.create(req.body);
    res.status(201).json({ success: true, faq });
});

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Home Step In API is running' });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

module.exports = app;

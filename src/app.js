const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { webhook } = require('./controllers/paymentController');
const { protect, admin } = require('./middleware/auth');
const { rateLimit } = require('./middleware/rateLimit');
const { isAllowedOrigin } = require('./utils/corsOrigins');

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
}));
app.use(morgan('dev'));
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 180 }));

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
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/config', require('./routes/configRoutes'));

// FAQ Routes (inline for simplicity)
const FAQ = require('./models/FAQ');
app.get('/api/faqs', async (req, res) => {
    const faqs = await FAQ.find({ isActive: true });
    res.json({ success: true, faqs });
});
app.post('/api/faqs', protect, admin, async (req, res) => {
    const faq = await FAQ.create(req.body);
    res.status(201).json({ success: true, faq });
});

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Home Step In API is running' });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', database: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date() });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

module.exports = app;

const User = require('../models/User');
const Provider = require('../models/Provider');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token (Login/Signup)
// @route   POST /api/auth/customer/login
// @access  Public (Requires Firebase Token)
exports.customerLogin = async (req, res) => {
    const { phone, firebaseUid } = req.firebaseUser;

    try {
        let user = await User.findOne({ phone: phone || req.body.phone });

        if (!user) {
            // Register new user
            user = await User.create({
                phone: phone || req.body.phone,
                name: req.body.name || 'User',
                referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()
            });
        }

        res.status(200).json({
            success: true,
            token: generateToken(user._id),
            user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Auth provider & get token (Login/Signup)
// @route   POST /api/auth/provider/login
// @access  Public (Requires Firebase Token)
exports.providerLogin = async (req, res) => {
    const { phone } = req.firebaseUser;

    try {
        let provider = await Provider.findOne({ phone: phone || req.body.phone });

        if (!provider) {
            // New providers must go through KYC/Approval
            return res.status(403).json({ 
                success: false, 
                message: 'Provider not registered. Please sign up and wait for admin approval.',
                isRegistered: false
            });
        }

        if (provider.status === 'pending') {
            return res.status(403).json({ success: false, message: 'Your account is pending approval.' });
        }

        res.status(200).json({
            success: true,
            token: generateToken(provider._id),
            provider
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Register provider
// @route   POST /api/auth/provider/register
// @access  Public
exports.providerRegister = async (req, res) => {
    const { phone, name, categories, serviceArea } = req.body;

    try {
        let provider = await Provider.findOne({ phone });

        if (provider) {
            return res.status(400).json({ success: false, message: 'Provider already exists' });
        }

        provider = await Provider.create({
            phone,
            name,
            categories,
            serviceArea: {
                type: 'Point',
                coordinates: serviceArea.coordinates // [lng, lat]
            }
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please upload KYC documents for approval.',
            provider
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

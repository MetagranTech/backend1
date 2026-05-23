const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const admin = require('firebase-admin');

// Firebase Admin initialization (should be done in a separate config file ideally)
// For now, we'll assume it's initialized in config/firebase.js

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user/provider exists
        let user = await User.findById(decoded.id);
        if (!user) {
            user = await Provider.findById(decoded.id);
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Since we don't have explicit roles in the model yet, we can check the model name or status
        // For Admin panel, we might need a separate Admin model or a role field
        next();
    };
};

exports.verifyFirebaseToken = async (req, res, next) => {
    const idToken = req.body.idToken;

    if (!idToken) {
        return res.status(400).json({ success: false, message: 'Firebase ID Token is required' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.firebaseUser = decodedToken;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid Firebase Token', error: error.message });
    }
};

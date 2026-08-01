const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');

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

        const models = { customer: User, provider: Provider, admin: Admin };
        const Model = models[decoded.type];
        if (!Model) return res.status(401).json({ success: false, message: 'Invalid token type' });
        const user = await Model.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User no longer exists' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Account is suspended' });
        }
        req.user = user;
        req.authType = decoded.type;
        req.role = decoded.role || decoded.type;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.role) && !roles.includes(req.authType)) {
            return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
        }
        next();
    };
};

exports.admin = (req, res, next) => {
    if (req.authType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const firebaseAdmin = require('../config/firebase');

const generateToken = (id, type, role = type) => jwt.sign(
    { id, type, role }, process.env.JWT_SECRET,
    { expiresIn: type === 'admin' ? '12h' : '30d', issuer: 'home-step-in-api' }
);

const normalizePhone = (input) => {
    const digits = String(input || '').replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
    if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
    return null;
};

const findAccount = (accountType, phone) => accountType === 'customer'
    ? User.findOne({ phone })
    : Provider.findOne({ phone });

const validateFirebaseFlow = async (accountType, purpose, phone) => {
    if (!phone || !['customer', 'provider'].includes(accountType) || !['login', 'register'].includes(purpose)) {
        return { status: 400, message: 'Valid Indian phone, account type and purpose are required' };
    }
    const account = await findAccount(accountType, phone);
    if (purpose === 'login' && !account) return { status: 404, message: 'Account not found. Please register first.' };
    if (purpose === 'register' && account) return { status: 409, message: 'Account already exists. Please login.' };
    if (account?.status === 'suspended') return { status: 403, message: 'Account is suspended' };
    if (accountType === 'provider' && purpose === 'login' && account?.status !== 'active') {
        return { status: 403, message: 'Provider account is pending admin approval' };
    }
    return { account };
};

// Firebase sends the SMS from the Android apps. This endpoint prevents sending
// an OTP for an impossible login/register flow before the client starts it.
exports.checkFirebasePhone = async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const result = await validateFirebaseFlow(req.body.accountType, req.body.purpose, phone);
    if (result.message) return res.status(result.status).json({ success: false, message: result.message });
    res.json({ success: true, phone });
};

// Firebase proves ownership of the phone number; MongoDB remains the source of
// truth for profiles/roles and this API still issues the app's JWT.
exports.verifyFirebasePhone = async (req, res) => {
    const { idToken, accountType, purpose } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'Firebase ID token is required' });

    let decoded;
    try {
        decoded = await firebaseAdmin.auth().verifyIdToken(idToken, true);
    } catch (_) {
        return res.status(401).json({ success: false, message: 'Phone verification is invalid or expired' });
    }
    if (decoded.firebase?.sign_in_provider !== 'phone') {
        return res.status(401).json({ success: false, message: 'Phone authentication is required' });
    }
    const phone = normalizePhone(decoded.phone_number);
    const result = await validateFirebaseFlow(accountType, purpose, phone);
    if (result.message) return res.status(result.status).json({ success: false, message: result.message });

    if (accountType === 'provider' && purpose === 'register') {
        const registrationToken = jwt.sign(
            { type: 'provider_registration', phone, firebaseUid: decoded.uid },
            process.env.JWT_SECRET,
            { expiresIn: '15m', issuer: 'home-step-in-api' }
        );
        return res.json({ success: true, registrationToken, phone, purpose });
    }

    let account = result.account;
    if (accountType === 'customer' && purpose === 'register') {
        account = await User.create({
            phone,
            firebaseUid: decoded.uid,
            name: req.body.name?.trim() || 'User',
            referralCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
            fcmToken: req.body.fcmToken
        });
    } else if (account.firebaseUid && account.firebaseUid !== decoded.uid) {
        return res.status(409).json({ success: false, message: 'Phone is linked to another Firebase account' });
    } else if (!account.firebaseUid) {
        account.firebaseUid = decoded.uid;
    }

    if (req.body.fcmToken) account.fcmToken = req.body.fcmToken;
    if (account.isModified()) await account.save();
    const type = accountType;
    res.json({ success: true, token: generateToken(account._id, type), [type === 'customer' ? 'user' : 'provider']: account });
};

exports.providerRegister = async (req, res) => {
    let verified;
    try {
        verified = jwt.verify(req.body.registrationToken, process.env.JWT_SECRET, { issuer: 'home-step-in-api' });
    } catch (_) {
        return res.status(401).json({ success: false, message: 'Phone verification expired. Request a new OTP.' });
    }
    if (verified.type !== 'provider_registration') return res.status(401).json({ success: false, message: 'Invalid registration token' });
    const { name, categories, serviceArea } = req.body;
    if (!name?.trim() || !Array.isArray(categories) || !categories.length) {
        return res.status(400).json({ success: false, message: 'Name and at least one category are required' });
    }
    const coordinates = serviceArea?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(Number(value)))) {
        return res.status(400).json({ success: false, message: 'Valid service area coordinates [lng, lat] are required' });
    }
    if (await Provider.exists({ phone: verified.phone })) return res.status(409).json({ success: false, message: 'Provider already exists' });
    const provider = await Provider.create({
        phone: verified.phone, firebaseUid: verified.firebaseUid, name: name.trim(), categories,
        serviceArea: { type: 'Point', coordinates: coordinates.map(Number), radiusInKm: Number(serviceArea.radiusInKm) || 10 },
        fcmToken: req.body.fcmToken
    });
    res.status(201).json({ success: true, token: generateToken(provider._id, 'provider'), provider });
};

exports.adminLogin = async (req, res) => {
    const email = req.body.email?.toLowerCase().trim();
    const password = req.body.password;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    let admin = await Admin.findOne({ email }).select('+passwordHash');
    if (!admin && await Admin.countDocuments() === 0 && email === process.env.ADMIN_EMAIL?.toLowerCase()) {
        if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) return res.status(503).json({ success: false, message: 'Secure bootstrap admin credentials are not configured' });
        admin = await Admin.create({ name: 'Platform Admin', email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'super_admin' });
        admin = await Admin.findById(admin._id).select('+passwordHash');
    }
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (admin.status !== 'active') return res.status(403).json({ success: false, message: 'Admin account is suspended' });
    res.json({ success: true, token: generateToken(admin._id, 'admin', admin.role), admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
};

exports.updateFcmToken = async (req, res) => {
    req.user.fcmToken = req.body.fcmToken || undefined;
    await req.user.save();
    res.json({ success: true });
};

exports.me = async (req, res) => res.json({ success: true, type: req.authType, user: req.user });

exports._test = { normalizePhone };

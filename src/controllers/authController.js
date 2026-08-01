const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const EmailOtp = require('../models/EmailOtp');
const { sendRegistrationOtp } = require('../services/emailService');

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

const normalizeEmail = (input) => {
    const email = String(input || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const validatePassword = (input) => typeof input === 'string' && input.length >= 8 && input.length <= 72;
const newOtp = () => String(crypto.randomInt(100000, 1000000));
const validObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

exports.requestRegistrationOtp = async (req, res) => {
    const accountType = req.body.accountType;
    const phone = normalizePhone(req.body.phone);
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const password = req.body.password;
    if (!['customer', 'provider'].includes(accountType) || !phone || !email || !name || !validatePassword(password)) {
        return res.status(400).json({ success: false, message: 'Name, valid phone, email and password of at least 8 characters are required' });
    }
    const Model = accountType === 'customer' ? User : Provider;
    if (await Model.exists({ $or: [{ phone }, { email }] })) {
        return res.status(409).json({ success: false, message: 'Phone number or email is already registered. Please login.' });
    }

    const otp = newOtp();
    const challenge = await EmailOtp.create({
        accountType, name, phone, email,
        passwordHash: await bcrypt.hash(password, 12),
        otpHash: await bcrypt.hash(otp, 10),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    try {
        await sendRegistrationOtp({ email, name, otp });
    } catch (error) {
        await EmailOtp.deleteOne({ _id: challenge._id });
        throw error;
    }
    res.json({ success: true, challengeId: challenge._id, email });
};

exports.resendRegistrationOtp = async (req, res) => {
    if (!validObjectId(req.body.challengeId)) return res.status(400).json({ success: false, message: 'Invalid registration session' });
    const challenge = await EmailOtp.findOne({ _id: req.body.challengeId, consumedAt: null });
    if (!challenge || challenge.expiresAt <= new Date()) return res.status(410).json({ success: false, message: 'Registration session expired. Please start again.' });
    if (Date.now() - challenge.lastSentAt.getTime() < 60 * 1000) return res.status(429).json({ success: false, message: 'Please wait before requesting another code.' });
    const otp = newOtp();
    challenge.otpHash = await bcrypt.hash(otp, 10);
    challenge.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    challenge.lastSentAt = new Date();
    challenge.attempts = 0;
    await challenge.save();
    await sendRegistrationOtp({ email: challenge.email, name: challenge.name, otp });
    res.json({ success: true, challengeId: challenge._id, email: challenge.email });
};

exports.verifyRegistrationOtp = async (req, res) => {
    if (!validObjectId(req.body.challengeId)) return res.status(400).json({ success: false, message: 'Invalid registration session' });
    const challenge = await EmailOtp.findOne({ _id: req.body.challengeId, consumedAt: null });
    if (!challenge || challenge.expiresAt <= new Date()) return res.status(410).json({ success: false, message: 'OTP expired. Please request a new code.' });
    if (challenge.attempts >= 5) return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
    if (!await bcrypt.compare(String(req.body.otp || ''), challenge.otpHash)) {
        challenge.attempts += 1;
        await challenge.save();
        return res.status(400).json({ success: false, message: 'The OTP is incorrect' });
    }
    challenge.verifiedAt = new Date();
    await challenge.save();

    if (challenge.accountType === 'provider') {
        const registrationToken = jwt.sign(
            { type: 'provider_registration', challengeId: challenge._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m', issuer: 'home-step-in-api' }
        );
        return res.json({ success: true, registrationToken, phone: challenge.phone, email: challenge.email });
    }

    if (await User.exists({ $or: [{ phone: challenge.phone }, { email: challenge.email }] })) {
        return res.status(409).json({ success: false, message: 'Account already exists. Please login.' });
    }
    const account = await User.create({
            phone: challenge.phone,
            email: challenge.email,
            passwordHash: challenge.passwordHash,
            name: challenge.name,
            referralCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
            fcmToken: req.body.fcmToken
    });
    challenge.consumedAt = new Date();
    await challenge.save();
    res.json({ success: true, token: generateToken(account._id, 'customer'), user: account });
};

exports.login = async (req, res) => {
    const accountType = req.body.accountType;
    const phone = normalizePhone(req.body.phone);
    if (!['customer', 'provider'].includes(accountType) || !phone || !req.body.password) {
        return res.status(400).json({ success: false, message: 'Valid phone number and password are required' });
    }
    const Model = accountType === 'customer' ? User : Provider;
    const account = await Model.findOne({ phone }).select('+passwordHash');
    if (!account || !account.passwordHash || !await bcrypt.compare(req.body.password, account.passwordHash)) {
        return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }
    if (account.status === 'suspended') return res.status(403).json({ success: false, message: 'Account is suspended' });
    if (accountType === 'provider' && account.status !== 'active') return res.status(403).json({ success: false, message: 'Provider account is pending admin approval' });
    if (req.body.fcmToken) {
        account.fcmToken = req.body.fcmToken;
        await account.save();
    }
    res.json({ success: true, token: generateToken(account._id, accountType), [accountType === 'customer' ? 'user' : 'provider']: account });
};

exports.providerRegister = async (req, res) => {
    let verified;
    try {
        verified = jwt.verify(req.body.registrationToken, process.env.JWT_SECRET, { issuer: 'home-step-in-api' });
    } catch (_) {
        return res.status(401).json({ success: false, message: 'Phone verification expired. Request a new OTP.' });
    }
    if (verified.type !== 'provider_registration') return res.status(401).json({ success: false, message: 'Invalid registration token' });
    const challenge = await EmailOtp.findOne({ _id: verified.challengeId, accountType: 'provider', verifiedAt: { $ne: null }, consumedAt: null });
    if (!challenge) return res.status(401).json({ success: false, message: 'Registration verification is invalid or already used' });
    const { name, categories, serviceArea } = req.body;
    if (!name?.trim() || !Array.isArray(categories) || !categories.length) {
        return res.status(400).json({ success: false, message: 'Name and at least one category are required' });
    }
    const coordinates = serviceArea?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(Number(value)))) {
        return res.status(400).json({ success: false, message: 'Valid service area coordinates [lng, lat] are required' });
    }
    const normalizedCoordinates = coordinates.map(Number);
    if (Math.abs(normalizedCoordinates[0]) > 180 || Math.abs(normalizedCoordinates[1]) > 90) {
        return res.status(400).json({ success: false, message: 'Service area coordinates are outside valid longitude/latitude ranges' });
    }
    const radiusInKm = Number(serviceArea.radiusInKm);
    if (!Number.isFinite(radiusInKm) || radiusInKm < 1 || radiusInKm > 100) {
        return res.status(400).json({ success: false, message: 'Service radius must be between 1 and 100 km' });
    }
    const locationName = String(serviceArea.locationName || '').trim();
    if (await Provider.exists({ $or: [{ phone: challenge.phone }, { email: challenge.email }] })) return res.status(409).json({ success: false, message: 'Provider already exists' });
    const provider = await Provider.create({
        phone: challenge.phone, email: challenge.email, passwordHash: challenge.passwordHash, name: name.trim(), categories,
        serviceArea: { type: 'Point', coordinates: normalizedCoordinates, locationName, radiusInKm },
        fcmToken: req.body.fcmToken
    });
    challenge.consumedAt = new Date();
    await challenge.save();
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

exports.me = async (req, res) => {
    if (req.authType !== 'provider') {
        return res.json({ success: true, type: req.authType, user: req.user });
    }
    const totalCompletedJobs = await require('../models/Booking').countDocuments({
        provider: req.user._id,
        status: 'completed'
    });
    res.json({
        success: true,
        type: req.authType,
        user: { ...req.user.toObject(), totalCompletedJobs }
    });
};

exports._test = { normalizePhone, normalizeEmail, validatePassword };

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const OtpChallenge = require('../models/OtpChallenge');
const otpService = require('../services/otpService');

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

exports.sendOtp = async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const accountType = req.body.accountType;
    const purpose = req.body.purpose;
    if (!phone || !['customer', 'provider'].includes(accountType) || !['login', 'register'].includes(purpose)) {
        return res.status(400).json({ success: false, message: 'Valid Indian phone, account type and purpose are required' });
    }
    const account = await findAccount(accountType, phone);
    if (purpose === 'login' && !account) return res.status(404).json({ success: false, message: 'Account not found. Please register first.' });
    if (purpose === 'register' && account) return res.status(409).json({ success: false, message: 'Account already exists. Please login.' });
    if (account?.status === 'suspended') return res.status(403).json({ success: false, message: 'Account is suspended' });
    if (accountType === 'provider' && purpose === 'login' && account?.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Provider account is pending admin approval' });
    }
    const recent = await OtpChallenge.findOne({
        phone, accountType, purpose, createdAt: { $gt: new Date(Date.now() - 60000) }, consumedAt: null
    }).sort('-createdAt');
    if (recent) return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another OTP' });

    const delivery = await otpService.send(phone);
    const challenge = await OtpChallenge.create({
        phone, accountType, purpose,
        provider: delivery.provider,
        providerRequestId: delivery.requestId,
        testOtpHash: delivery.testOtpHash,
        metadata: { name: req.body.name?.trim() },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    const payload = { success: true, challengeId: challenge._id, expiresIn: 300, resendAfter: 60 };
    if (delivery.provider === 'test' && process.env.NODE_ENV !== 'production') payload.testOtp = delivery.testOtp;
    res.status(201).json(payload);
};

exports.resendOtp = async (req, res) => {
    const challenge = await OtpChallenge.findById(req.body.challengeId).select('+testOtpHash');
    if (!challenge || challenge.consumedAt) return res.status(404).json({ success: false, message: 'OTP request not found' });
    if (Date.now() - challenge.updatedAt.getTime() < 60000) {
        return res.status(429).json({ success: false, message: 'Please wait 60 seconds before resending OTP' });
    }
    const delivery = await otpService.send(challenge.phone);
    challenge.provider = delivery.provider;
    challenge.providerRequestId = delivery.requestId;
    challenge.testOtpHash = delivery.testOtpHash;
    challenge.attempts = 0;
    challenge.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await challenge.save();
    const payload = { success: true, challengeId: challenge._id, expiresIn: 300, resendAfter: 60 };
    if (delivery.provider === 'test' && process.env.NODE_ENV !== 'production') payload.testOtp = delivery.testOtp;
    res.json(payload);
};

exports.verifyOtp = async (req, res) => {
    const otp = String(req.body.otp || '');
    const challenge = await OtpChallenge.findById(req.body.challengeId).select('+testOtpHash');
    if (!challenge || challenge.consumedAt) return res.status(404).json({ success: false, message: 'OTP request not found or already used' });
    if (challenge.expiresAt.getTime() <= Date.now()) return res.status(410).json({ success: false, message: 'OTP has expired' });
    if (challenge.attempts >= 5) return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts' });
    if (!/^\d{4,8}$/.test(otp)) return res.status(400).json({ success: false, message: 'Enter a valid OTP' });
    const attempt = await OtpChallenge.updateOne(
        { _id: challenge._id, consumedAt: null, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } }
    );
    if (attempt.modifiedCount !== 1) return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts' });
    const verified = await otpService.verify(challenge, otp);
    if (!verified) return res.status(401).json({ success: false, message: 'Invalid OTP' });
    const consumed = await OtpChallenge.findOneAndUpdate(
        { _id: challenge._id, consumedAt: null, expiresAt: { $gt: new Date() } },
        { consumedAt: new Date() }, { new: true }
    );
    if (!consumed) return res.status(409).json({ success: false, message: 'OTP was already used' });

    if (challenge.accountType === 'provider' && challenge.purpose === 'register') {
        const registrationToken = jwt.sign(
            { type: 'provider_registration', phone: challenge.phone },
            process.env.JWT_SECRET,
            { expiresIn: '15m', issuer: 'home-step-in-api' }
        );
        return res.json({ success: true, registrationToken, phone: challenge.phone, purpose: 'register' });
    }

    let account = await findAccount(challenge.accountType, challenge.phone);
    if (challenge.accountType === 'customer' && challenge.purpose === 'register') {
        account = await User.create({
            phone: challenge.phone,
            name: challenge.metadata?.name || 'User',
            referralCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
            fcmToken: req.body.fcmToken
        });
    }
    if (!account) return res.status(404).json({ success: false, message: 'Account no longer exists' });
    if (req.body.fcmToken) { account.fcmToken = req.body.fcmToken; await account.save(); }
    const type = challenge.accountType;
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
        phone: verified.phone, name: name.trim(), categories,
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

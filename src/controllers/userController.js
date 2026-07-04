const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.updateProfile = async (req, res) => {
    const allowed = ['name', 'email', 'profilePic'];
    for (const key of allowed) if (req.body[key] !== undefined) req.user[key] = req.body[key];
    await req.user.save();
    res.json({ success: true, user: req.user });
};

exports.addAddress = async (req, res) => {
    const { label, street, city, state, zipCode, coordinates, isDefault } = req.body;
    if (!street?.trim()) {
        return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (isDefault) req.user.addresses.forEach((address) => { address.isDefault = false; });
    req.user.addresses.push({
        label: label?.trim() || 'Home',
        street: street.trim(),
        city: city?.trim() || '',
        state: state?.trim() || '',
        zipCode: zipCode?.trim() || '',
        coordinates,
        isDefault: Boolean(isDefault)
    });
    await req.user.save();
    res.status(201).json({ success: true, addresses: req.user.addresses });
};

exports.updateAddress = async (req, res) => {
    const address = req.user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
    if (req.body.street !== undefined && !req.body.street?.trim()) {
        return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (req.body.isDefault) req.user.addresses.forEach((item) => { item.isDefault = false; });
    Object.assign(address, req.body);
    await req.user.save();
    res.json({ success: true, addresses: req.user.addresses });
};

exports.deleteAddress = async (req, res) => {
    const address = req.user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
    address.deleteOne();
    await req.user.save();
    res.json({ success: true, addresses: req.user.addresses });
};

exports.wallet = async (req, res) => res.json({ success: true, balance: req.user.walletBalance, transactions: [] });

const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

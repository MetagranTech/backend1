const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    profilePic: {
        type: String,
        default: ''
    },
    categories: [{
        type: String, // Electrician, Plumbing, etc.
    }],
    skills: [String],
    experience: Number,
    kycDetails: {
        documentType: {
            type: String,
            enum: ['driving_license', 'aadhaar_card', 'voter_id']
        },
        idProofUrl: String,
        skillProofUrl: String,
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        rejectionReason: String
    },
    bankDetails: {
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String
    },
    serviceArea: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [lng, lat]
            required: true
        },
        locationName: {
            type: String,
            trim: true,
            default: ''
        },
        radiusInKm: {
            type: Number,
            default: 10
        }
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    rating: {
        type: Number,
        default: 0
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    lastLocation: {
        lat: Number,
        lng: Number
    },
    lastLocationUpdate: Date,
    fcmToken: String,
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'suspended'],
        default: 'pending'
    }
}, { timestamps: true });

providerSchema.index({ serviceArea: '2dsphere' });

module.exports = mongoose.model('Provider', providerSchema);

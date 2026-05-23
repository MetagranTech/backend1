const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');

// @desc    Raise a new complaint
// @route   POST /api/complaints
// @access  Private (User/Provider)
exports.raiseComplaint = async (req, res) => {
    const { bookingId, subject, description } = req.body;

    try {
        const complaint = await Complaint.create({
            booking: bookingId,
            user: req.user._id,
            subject,
            description
        });

        res.status(201).json({ success: true, complaint });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all complaints for a user
// @route   GET /api/complaints
// @access  Private
exports.getMyComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({ user: req.user._id }).populate('booking');
        res.status(200).json({ success: true, complaints });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all complaints (Admin)
// @route   GET /api/admin/complaints
// @access  Private (Admin)
exports.getAllComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find().populate('user', 'name phone').populate('booking');
        res.status(200).json({ success: true, complaints });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resolve a complaint
// @route   PUT /api/admin/complaints/:id/resolve
// @access  Private (Admin)
exports.resolveComplaint = async (req, res) => {
    const { resolution } = req.body;

    try {
        const complaint = await Complaint.findByIdAndUpdate(req.params.id, {
            status: 'resolved',
            resolution,
            resolvedAt: Date.now()
        }, { new: true });

        res.status(200).json({ success: true, complaint });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

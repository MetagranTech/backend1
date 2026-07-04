const express = require('express');
const router = express.Router();
const { sendOtp, resendOtp, verifyOtp, providerRegister, adminLogin, updateFcmToken, me } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const Provider = require('../models/Provider');
const { rateLimit } = require('../middleware/rateLimit');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
router.post('/otp/send', sendOtp);
router.post('/otp/resend', resendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/provider/register', providerRegister);
router.post('/admin/login', adminLogin);
router.get('/me', protect, me);
router.put('/fcm-token', protect, updateFcmToken);

router.post('/provider/kyc', protect, authorize('provider'), upload.fields([
    { name: 'idProof', maxCount: 1 }, { name: 'skillProof', maxCount: 1 }
]), async (req, res, next) => {
    try {
        if (!req.files?.idProof?.[0] || !req.files?.skillProof?.[0]) return res.status(400).json({ success: false, message: 'ID proof and skill proof are required' });
        const provider = await Provider.findByIdAndUpdate(req.user._id, {
            'kycDetails.idProofUrl': req.files.idProof[0].path,
            'kycDetails.skillProofUrl': req.files.skillProof[0].path,
            'kycDetails.status': 'pending',
            'kycDetails.rejectionReason': undefined
        }, { new: true });
        res.json({ success: true, provider });
    } catch (error) { next(error); }
});

module.exports = router;

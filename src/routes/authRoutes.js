const express = require('express');
const router = express.Router();
const { customerLogin, providerLogin, providerRegister } = require('../controllers/authController');
const { verifyFirebaseToken } = require('../middleware/auth');

const { upload } = require('../config/cloudinary');

router.post('/customer/login', verifyFirebaseToken, customerLogin);
router.post('/provider/login', verifyFirebaseToken, providerLogin);
router.post('/provider/register', providerRegister);
router.post('/provider/kyc', upload.fields([
    { name: 'idProof', maxCount: 1 },
    { name: 'skillProof', maxCount: 1 }
]), (req, res) => {
    // Controller logic will go here
    res.status(200).json({ 
        success: true, 
        idProofUrl: req.files.idProof[0].path,
        skillProofUrl: req.files.skillProof[0].path 
    });
});

module.exports = router;

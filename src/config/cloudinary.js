const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'home_step_in/kyc',
        allowed_formats: ['jpg', 'png', 'jpeg'],
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 4 },
    fileFilter(req, file, callback) {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) return callback(new Error('Only JPG and PNG images are allowed'));
        callback(null, true);
    }
});

module.exports = { cloudinary, upload };

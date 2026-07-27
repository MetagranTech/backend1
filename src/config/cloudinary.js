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

const bannerStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'home_step_in/banners',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1600, height: 700, crop: 'limit', quality: 'auto' }]
    }
});

const bannerUpload = multer({
    storage: bannerStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new Error('Only JPG, PNG and WEBP banner images are allowed'));
        }
        callback(null, true);
    }
});

module.exports = { cloudinary, upload, bannerUpload };

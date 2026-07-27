const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const { protect, admin } = require('../middleware/auth');
const { bannerUpload } = require('../config/cloudinary');

router.get('/banners', async (req, res) => {
    const config = await AppConfig.findOne({ key: 'banners' });
    res.json({ success: true, banners: config?.value || { row3: [], row5: [] } });
});

router.put('/banners', protect, admin, async (req, res) => {
    const clean = (items) => (Array.isArray(items) ? items : []).filter((url) => typeof url === 'string' && /^https:\/\//.test(url)).slice(0, 10);
    const value = { row3: clean(req.body.row3), row5: clean(req.body.row5) };
    const config = await AppConfig.findOneAndUpdate({ key: 'banners' }, { value }, { upsert: true, new: true });
    res.json({ success: true, banners: config.value });
});

router.post(
    '/banners/upload',
    protect,
    admin,
    (req, res, next) => {
        if (!['row3', 'row5'].includes(req.query.row)) {
            return res.status(400).json({ success: false, message: 'Choose a valid slideshow section' });
        }
        next();
    },
    bannerUpload.single('image'),
    async (req, res) => {
        if (!req.file?.path) {
            return res.status(400).json({ success: false, message: 'Choose an image to upload' });
        }
        const row = req.query.row;
        const config = await AppConfig.findOne({ key: 'banners' });
        const current = config?.value || { row3: [], row5: [] };
        const value = {
            row3: Array.isArray(current.row3) ? current.row3.slice(0, 10) : [],
            row5: Array.isArray(current.row5) ? current.row5.slice(0, 10) : []
        };
        if (value[row].length >= 10) {
            return res.status(400).json({ success: false, message: 'A slideshow can contain up to 10 images' });
        }
        value[row].push(req.file.path);
        const saved = await AppConfig.findOneAndUpdate(
            { key: 'banners' },
            { value },
            { upsert: true, new: true }
        );
        res.status(201).json({ success: true, imageUrl: req.file.path, banners: saved.value });
    }
);

module.exports = router;

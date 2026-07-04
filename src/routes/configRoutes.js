const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const { protect, admin } = require('../middleware/auth');

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

module.exports = router;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

exports.requireFields = (...fields) => (req, res, next) => {
    const missing = fields.filter((field) => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
    });
    if (missing.length) {
        return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
};

exports.validateObjectIdParam = (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id || '')) {
        return res.status(400).json({ success: false, message: 'Invalid resource id' });
    }
    next();
};

exports.validateBookingInput = (req, res, next) => {
    const { serviceId, address, scheduledDate, timeSlot } = req.body;
    const coordinates = address?.coordinates;
    if (!/^[a-f\d]{24}$/i.test(serviceId || '') || !address || !isNonEmptyString(timeSlot)) {
        return res.status(400).json({ success: false, message: 'Valid service, address and time slot are required' });
    }
    const date = new Date(scheduledDate);
    if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 60000) {
        return res.status(400).json({ success: false, message: 'Scheduled date must be in the future' });
    }
    const lat = Number(coordinates?.lat);
    const lng = Number(coordinates?.lng);
    if (!coordinates || !Number.isFinite(lat) || !Number.isFinite(lng)
        || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ success: false, message: 'Valid service address coordinates are required' });
    }
    req.body.address.coordinates = { lat, lng };
    next();
};

exports.validatePositiveAmount = (req, res, next) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }
    req.body.amount = amount;
    next();
};

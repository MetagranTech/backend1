const buckets = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
}, 60000).unref();

exports.rateLimit = ({ windowMs = 60000, max = 60 } = {}) => (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - bucket.count));
    if (bucket.count > max) return res.status(429).json({ success: false, message: 'Too many requests. Try again later.' });
    next();
};

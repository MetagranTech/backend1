const express = require('express');
const router = express.Router();
const { listServices, createService, updateService, deleteService } = require('../controllers/serviceController');
const { protect, admin } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validate');

router.get('/', (req, res, next) => {
    if (req.query.includeInactive !== 'true') return next();
    protect(req, res, () => admin(req, res, next));
}, listServices);
router.post('/', protect, admin, createService);
router.put('/:id', protect, admin, validateObjectIdParam, updateService);
router.delete('/:id', protect, admin, validateObjectIdParam, deleteService);

module.exports = router;

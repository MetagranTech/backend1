const Service = require('../models/Service');

exports.listServices = async (req, res) => {
    const query = req.authType === 'admin' && req.query.includeInactive === 'true' ? {} : { isActive: true };
    const services = await Service.find(query).sort({ category: 1, name: 1 });
    res.json({ success: true, services });
};

exports.createService = async (req, res) => {
    const service = await Service.create(req.body);
    res.status(201).json({ success: true, service });
};

exports.updateService = async (req, res) => {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, service });
};

exports.deleteService = async (req, res) => {
    const service = await Service.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, service });
};

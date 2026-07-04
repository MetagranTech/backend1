require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../src/models/Service');

const categories = [
    ['Electrician Inspection', 'Electrician', 399],
    ['Plumbing Inspection', 'Plumbing', 399],
    ['AC Repair Inspection', 'AC Repair', 499],
    ['Fridge Repair Inspection', 'Fridge Repair', 499],
    ['Washing Machine Inspection', 'Washing Machine Repair', 499],
    ['Tank Cleaning', 'Tank Cleaning', 999],
    ['Bathroom Cleaning', 'Bathroom Cleaning', 799],
    ['Home Cleaning', 'Home Cleaning', 1299]
];

async function run() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    await mongoose.connect(process.env.MONGODB_URI);
    for (const [name, category, basePrice] of categories) {
        await Service.findOneAndUpdate({ name }, {
            name, category, basePrice,
            description: `${category} service by a verified technician`,
            pricingType: category.includes('Cleaning') ? 'fixed' : 'inspection',
            gstPercentage: 18,
            platformFee: 50,
            isActive: true
        }, { upsert: true, new: true, runValidators: true });
    }
    console.log(`Seeded ${categories.length} services`);
    await mongoose.disconnect();
}

run().catch((error) => { console.error(error.message); process.exit(1); });

// Catch any uncaught errors and print them before exiting
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
    process.exit(1);
});

require('dotenv').config();
const app = require('./src/app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const required = ['MONGODB_URI', 'JWT_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.error(`FATAL: Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
        const shutdown = () => server.close(async () => {
            await mongoose.connection.close();
            process.exit(0);
        });
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    })
    .catch((err) => {
        console.error('FATAL: Database connection error:', err.message);
        process.exit(1);
    });

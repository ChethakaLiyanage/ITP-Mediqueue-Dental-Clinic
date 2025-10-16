const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Counter = require('../Model/Counter');

// Load environment variables
dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Reset the admin counter to 0
        const result = await Counter.findOneAndUpdate(
            { scope: 'admin' },
            { $set: { seq: 0 } },
            { upsert: true, new: true }
        );
        
        console.log('Admin counter has been reset successfully!');
        console.log('Next admin ID will be: AD-0001');
        
        // Close the connection
        mongoose.connection.close();
    } catch (error) {
        console.error('Error resetting admin counter:', error);
        mongoose.connection.close();
    }
});

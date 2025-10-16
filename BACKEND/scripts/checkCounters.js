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
        // Get all counters
        const counters = await Counter.find({});
        
        if (counters.length === 0) {
            console.log('No counters found in the database');
        } else {
            console.log('Current counters in the database:');
            counters.forEach(counter => {
                console.log(`- Scope: ${counter.scope}, Sequence: ${counter.seq}`);
            });
        }
        
        // Close the connection
        mongoose.connection.close();
    } catch (error) {
        console.error('Error checking counters:', error);
        mongoose.connection.close();
    }
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Dentist = require('../Model/DentistModel');
const User = require('../Model/User');
const { getAvailableSlots } = require('../Services/AvailabilityService');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  dbName: "Mediqueue_dental_clinic",
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Get all dentists
    const dentists = await Dentist.find({}).populate('userId', 'name').lean();
    console.log(`\nFound ${dentists.length} dentists`);
    
    // Test availability for today and tomorrow
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`\n=== TESTING AVAILABILITY FOR ${today} AND ${tomorrow} ===`);
    
    for (const dentist of dentists) {
      const dentistName = dentist.userId?.name || 'Unknown';
      console.log(`\n--- ${dentistName} (${dentist.dentistCode}) ---`);
      
      // Test today
      console.log(`\n  Testing ${today}:`);
      try {
        const todaySlots = await getAvailableSlots(dentist.dentistCode, today);
        console.log(`    ✅ Found ${todaySlots.slots.length} available slots`);
        if (todaySlots.slots.length > 0) {
          console.log(`    📅 First few slots: ${todaySlots.slots.slice(0, 3).map(s => s.start.split('T')[1].substring(0, 5)).join(', ')}`);
        }
        if (todaySlots.message) {
          console.log(`    ℹ️ Message: ${todaySlots.message}`);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
      }
      
      // Test tomorrow
      console.log(`\n  Testing ${tomorrow}:`);
      try {
        const tomorrowSlots = await getAvailableSlots(dentist.dentistCode, tomorrow);
        console.log(`    ✅ Found ${tomorrowSlots.slots.length} available slots`);
        if (tomorrowSlots.slots.length > 0) {
          console.log(`    📅 First few slots: ${tomorrowSlots.slots.slice(0, 3).map(s => s.start.split('T')[1].substring(0, 5)).join(', ')}`);
        }
        if (tomorrowSlots.message) {
          console.log(`    ℹ️ Message: ${tomorrowSlots.message}`);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error testing availability:', error);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Dentist = require('../Model/DentistModel');
const User = require('../Model/User');
const ScheduleService = require('../Services/ScheduleService');

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
    
    // Generate slots for the next 30 days
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);
    
    console.log(`\n=== GENERATING SLOTS FOR NEXT 30 DAYS ===`);
    console.log(`From: ${today.toISOString().split('T')[0]}`);
    console.log(`To: ${endDate.toISOString().split('T')[0]}`);
    
    let totalSlotsCreated = 0;
    
    for (const dentist of dentists) {
      const dentistName = dentist.userId?.name || 'Unknown';
      console.log(`\n--- ${dentistName} (${dentist.dentistCode}) ---`);
      
      let dentistSlotsCreated = 0;
      
      // Generate slots for each day
      const currentDate = new Date(today);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        try {
          // Use ScheduleService to ensure slots exist
          await ScheduleService.ensureSlotsExist(dentist.dentistCode, dateStr);
          
          // Count how many slots were created for this date
          const ScheduleModel = require('../Model/ScheduleModel');
          const slotsForDate = await ScheduleModel.countDocuments({
            dentistCode: dentist.dentistCode,
            date: new Date(dateStr + 'T00:00:00.000Z')
          });
          
          if (slotsForDate > 0) {
            dentistSlotsCreated += slotsForDate;
            console.log(`  ✅ ${dateStr}: ${slotsForDate} slots`);
          } else {
            console.log(`  ⚠️ ${dateStr}: No slots created (dentist not working this day)`);
          }
          
        } catch (error) {
          console.log(`  ❌ ${dateStr}: Error - ${error.message}`);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`  📊 Total slots created for ${dentistName}: ${dentistSlotsCreated}`);
      totalSlotsCreated += dentistSlotsCreated;
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total dentists: ${dentists.length}`);
    console.log(`Total slots created: ${totalSlotsCreated}`);
    console.log(`Average slots per dentist: ${Math.round(totalSlotsCreated / dentists.length)}`);
    
    // Show sample slots for verification
    console.log(`\n=== SAMPLE SLOTS (First 10) ===`);
    const ScheduleModel = require('../Model/ScheduleModel');
    const sampleSlots = await ScheduleModel.find({})
      .sort({ date: 1, timeSlot: 1 })
      .limit(10)
      .lean();
    
    for (const slot of sampleSlots) {
      console.log(`${slot.dentistCode} - ${slot.date.toISOString().split('T')[0]} - ${slot.timeSlot} - ${slot.status}`);
    }
    
  } catch (error) {
    console.error('Error generating slots:', error);
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

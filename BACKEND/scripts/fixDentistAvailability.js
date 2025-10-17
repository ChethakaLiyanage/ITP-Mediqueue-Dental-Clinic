const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Dentist = require('../Model/DentistModel');
const User = require('../Model/User');

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
    
    // Default availability schedule (standard dental clinic hours)
    const defaultAvailabilitySchedule = {
      'Mon': '09:00-17:00',
      'Tue': '09:00-17:00', 
      'Wed': '09:00-17:00',
      'Thu': '09:00-17:00',
      'Fri': '09:00-17:00',
      'Sat': '09:00-13:00',
      'Sun': 'Not Available'
    };
    
    console.log('\n=== CHECKING DENTIST AVAILABILITY SCHEDULES ===');
    
    let updatedCount = 0;
    
    for (const dentist of dentists) {
      const dentistName = dentist.userId?.name || 'Unknown';
      console.log(`\n--- ${dentistName} (${dentist.dentistCode}) ---`);
      console.log('Current availability_schedule:', JSON.stringify(dentist.availability_schedule, null, 2));
      
      // Check if dentist has no availability schedule or it's empty
      if (!dentist.availability_schedule || Object.keys(dentist.availability_schedule).length === 0) {
        console.log('❌ No availability schedule found - setting default schedule');
        
        // Update the dentist with default schedule
        await Dentist.updateOne(
          { _id: dentist._id },
          { $set: { availability_schedule: defaultAvailabilitySchedule } }
        );
        
        console.log('✅ Updated with default schedule');
        updatedCount++;
      } else {
        // Check if the schedule is properly formatted
        const schedule = dentist.availability_schedule;
        let needsUpdate = false;
        const updatedSchedule = {};
        
        // Check each day
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (const day of days) {
          const daySchedule = schedule[day];
          
          if (!daySchedule) {
            // Day not defined, use default
            updatedSchedule[day] = defaultAvailabilitySchedule[day];
            needsUpdate = true;
            console.log(`⚠️ ${day} not defined - using default: ${defaultAvailabilitySchedule[day]}`);
          } else if (typeof daySchedule === 'object') {
            // Check if it's the new object format
            if (daySchedule.start && daySchedule.end) {
              // Convert to string format for consistency
              updatedSchedule[day] = `${daySchedule.start}-${daySchedule.end}`;
              if (daySchedule.available === false) {
                updatedSchedule[day] = 'Not Available';
              }
              needsUpdate = true;
              console.log(`🔄 Converting ${day} from object to string format: ${updatedSchedule[day]}`);
            } else if (daySchedule.startTime && daySchedule.endTime) {
              // Alternative object format
              updatedSchedule[day] = `${daySchedule.startTime}-${daySchedule.endTime}`;
              if (daySchedule.isWorking === false || daySchedule.available === false) {
                updatedSchedule[day] = 'Not Available';
              }
              needsUpdate = true;
              console.log(`🔄 Converting ${day} from alternative object to string format: ${updatedSchedule[day]}`);
            } else {
              // Keep existing format
              updatedSchedule[day] = daySchedule;
            }
          } else if (typeof daySchedule === 'string') {
            // Check if it's a valid time format
            if (daySchedule.includes('-') && daySchedule.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) {
              // Valid time format, keep it
              updatedSchedule[day] = daySchedule;
            } else if (daySchedule.toLowerCase().includes('not') || daySchedule === '-') {
              // Not available format, standardize it
              updatedSchedule[day] = 'Not Available';
              needsUpdate = true;
              console.log(`🔄 Standardizing ${day} not available format: ${daySchedule} -> Not Available`);
            } else {
              // Invalid format, use default
              updatedSchedule[day] = defaultAvailabilitySchedule[day];
              needsUpdate = true;
              console.log(`❌ Invalid format for ${day}: ${daySchedule} - using default: ${defaultAvailabilitySchedule[day]}`);
            }
          } else {
            // Unknown format, use default
            updatedSchedule[day] = defaultAvailabilitySchedule[day];
            needsUpdate = true;
            console.log(`❌ Unknown format for ${day}: ${daySchedule} - using default: ${defaultAvailabilitySchedule[day]}`);
          }
        }
        
        if (needsUpdate) {
          await Dentist.updateOne(
            { _id: dentist._id },
            { $set: { availability_schedule: updatedSchedule } }
          );
          console.log('✅ Updated schedule format');
          updatedCount++;
        } else {
          console.log('✅ Schedule is already properly formatted');
        }
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total dentists: ${dentists.length}`);
    console.log(`Updated schedules: ${updatedCount}`);
    console.log(`No changes needed: ${dentists.length - updatedCount}`);
    
    // Show final schedules
    console.log('\n=== FINAL AVAILABILITY SCHEDULES ===');
    const finalDentists = await Dentist.find({}).populate('userId', 'name').lean();
    
    for (const dentist of finalDentists) {
      const dentistName = dentist.userId?.name || 'Unknown';
      console.log(`\n${dentistName} (${dentist.dentistCode}):`);
      console.log(JSON.stringify(dentist.availability_schedule, null, 2));
    }
    
  } catch (error) {
    console.error('Error fixing dentist availability:', error);
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

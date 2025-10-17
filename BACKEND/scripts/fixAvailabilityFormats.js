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
    
    console.log('\n=== FIXING AVAILABILITY FORMAT ISSUES ===');
    
    let updatedCount = 0;
    
    for (const dentist of dentists) {
      const dentistName = dentist.userId?.name || 'Unknown';
      console.log(`\n--- ${dentistName} (${dentist.dentistCode}) ---`);
      
      const schedule = dentist.availability_schedule;
      if (!schedule) {
        console.log('No schedule to fix');
        continue;
      }
      
      let needsUpdate = false;
      const fixedSchedule = {};
      
      // Process each day
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      for (const day of days) {
        const daySchedule = schedule[day];
        
        if (!daySchedule) {
          // Day not defined, skip it (will use defaults in availability service)
          continue;
        }
        
        if (Array.isArray(daySchedule)) {
          // Convert array format to string format
          // Take the first time slot if multiple exist
          const timeSlot = daySchedule[0];
          if (timeSlot && typeof timeSlot === 'string' && timeSlot.includes('-')) {
            fixedSchedule[day] = timeSlot;
            needsUpdate = true;
            console.log(`🔄 Fixed array format for ${day}: [${daySchedule.join(', ')}] -> ${timeSlot}`);
          } else {
            console.log(`❌ Invalid array format for ${day}:`, daySchedule);
          }
        } else if (typeof daySchedule === 'string') {
          // Already in correct format
          fixedSchedule[day] = daySchedule;
        } else if (typeof daySchedule === 'object') {
          // Handle object format
          if (daySchedule.start && daySchedule.end) {
            const timeSlot = `${daySchedule.start}-${daySchedule.end}`;
            fixedSchedule[day] = timeSlot;
            needsUpdate = true;
            console.log(`🔄 Fixed object format for ${day}: ${JSON.stringify(daySchedule)} -> ${timeSlot}`);
          } else if (daySchedule.startTime && daySchedule.endTime) {
            const timeSlot = `${daySchedule.startTime}-${daySchedule.endTime}`;
            fixedSchedule[day] = timeSlot;
            needsUpdate = true;
            console.log(`🔄 Fixed alternative object format for ${day}: ${JSON.stringify(daySchedule)} -> ${timeSlot}`);
          } else {
            console.log(`❌ Invalid object format for ${day}:`, daySchedule);
          }
        } else {
          console.log(`❌ Unknown format for ${day}:`, daySchedule);
        }
      }
      
      if (needsUpdate) {
        await Dentist.updateOne(
          { _id: dentist._id },
          { $set: { availability_schedule: fixedSchedule } }
        );
        console.log('✅ Updated schedule format');
        updatedCount++;
      } else {
        console.log('✅ Schedule format is already correct');
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
    console.error('Error fixing availability formats:', error);
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

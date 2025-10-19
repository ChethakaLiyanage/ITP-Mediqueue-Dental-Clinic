const mongoose = require('mongoose');
const DentistModel = require('./Model/DentistModel');
const ScheduleModel = require('./Model/ScheduleModel');

async function testSundayFix() {
  try {
    await mongoose.connect('mongodb://localhost:27017/mediqueue');
    console.log('Connected to MongoDB');
    
    // Find all dentists
    const dentists = await DentistModel.find({}).populate('userId', 'name isActive');
    console.log('\n=== Testing Sunday Availability ===');
    
    for (const dentist of dentists) {
      console.log(`\n🔍 Testing dentist: ${dentist.dentistCode} (${dentist.userId?.name || 'N/A'})`);
      console.log(`Active: ${dentist.userId?.isActive || false}`);
      console.log(`Availability: ${JSON.stringify(dentist.availability_schedule, null, 2)}`);
      
      // Check Sunday availability
      const sundaySchedule = dentist.availability_schedule?.Sun;
      if (sundaySchedule && sundaySchedule !== 'Not Available' && sundaySchedule !== '-') {
        console.log(`✅ Has Sunday availability: ${sundaySchedule}`);
        
        // Check if Sunday slots exist
        const nextSunday = new Date();
        while (nextSunday.getDay() !== 0) {
          nextSunday.setDate(nextSunday.getDate() + 1);
        }
        const sundayStr = nextSunday.toISOString().slice(0, 10);
        
        const sundaySlots = await ScheduleModel.find({
          dentistCode: dentist.dentistCode,
          date: { $gte: new Date(sundayStr + 'T00:00:00.000Z'), $lt: new Date(sundayStr + 'T23:59:59.999Z') }
        }).sort({ timeSlot: 1 });
        
        console.log(`📅 Sunday ${sundayStr} slots: ${sundaySlots.length}`);
        if (sundaySlots.length > 0) {
          console.log(`  Available slots: ${sundaySlots.map(s => s.timeSlot).join(', ')}`);
        } else {
          console.log(`  ❌ No slots found - need to generate them`);
        }
      } else {
        console.log(`⏭️ No Sunday availability`);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSundayFix();

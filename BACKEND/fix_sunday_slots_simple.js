const mongoose = require('mongoose');
const DentistModel = require('./Model/DentistModel');
const ScheduleModel = require('./Model/ScheduleModel');

async function fixSundaySlots() {
  try {
    await mongoose.connect('mongodb://localhost:27017/mediqueue');
    console.log('Connected to MongoDB');
    
    // Find all dentists
    const dentists = await DentistModel.find({}).populate('userId', 'name isActive');
    console.log('\n=== Available Dentists ===');
    
    for (const dentist of dentists) {
      console.log(`\n🔧 Processing dentist: ${dentist.dentistCode} (${dentist.userId?.name || 'N/A'})`);
      console.log(`Availability: ${JSON.stringify(dentist.availability_schedule, null, 2)}`);
      
      // Check if dentist has Sunday availability
      const sundaySchedule = dentist.availability_schedule?.Sun;
      if (!sundaySchedule || sundaySchedule === 'Not Available' || sundaySchedule === '-') {
        console.log(`⏭️ No Sunday availability for ${dentist.dentistCode}`);
        continue;
      }
      
      console.log(`✅ Found Sunday availability: ${sundaySchedule}`);
      
      // Generate slots for the next 4 Sundays
      const today = new Date();
      const sundays = [];
      
      // Find next 4 Sundays
      for (let i = 0; i < 28; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        if (date.getDay() === 0) { // Sunday
          sundays.push(date.toISOString().slice(0, 10));
        }
      }
      
      console.log(`📅 Generating slots for Sundays: ${sundays.join(', ')}`);
      
      // Parse working hours
      let startHour, endHour;
      if (typeof sundaySchedule === 'string' && sundaySchedule.includes('-')) {
        const [start, end] = sundaySchedule.split('-');
        startHour = parseInt(start.split(':')[0]);
        endHour = parseInt(end.split(':')[0]);
      } else {
        console.log(`⚠️ Invalid Sunday schedule format: ${sundaySchedule}`);
        continue;
      }
      
      console.log(`⏰ Working hours: ${startHour}:00 - ${endHour}:00`);
      
      // Generate time slots (30-minute intervals)
      const timeSlots = [];
      let currentHour = startHour;
      let currentMin = 0;
      
      while (currentHour < endHour || (currentHour === endHour && currentMin === 0)) {
        const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
        
        currentMin += 30;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
        
        const endTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
        
        if (currentHour < endHour || (currentHour === endHour && currentMin === 0)) {
          timeSlots.push(`${startTime}-${endTime}`);
        }
      }
      
      console.log(`📋 Generated ${timeSlots.length} time slots: ${timeSlots.join(', ')}`);
      
      // Create slots for each Sunday
      for (const sunday of sundays) {
        const dateObj = new Date(sunday + 'T00:00:00.000Z');
        
        // Check if slots already exist
        const existingSlots = await ScheduleModel.countDocuments({
          dentistCode: dentist.dentistCode,
          date: { $gte: new Date(sunday + 'T00:00:00.000Z'), $lt: new Date(sunday + 'T23:59:59.999Z') }
        });
        
        if (existingSlots > 0) {
          console.log(`⏭️ Slots already exist for ${sunday} (${existingSlots} slots)`);
          continue;
        }
        
        // Create new slots
        const slotsToCreate = timeSlots.map(timeSlot => ({
          dentistCode: dentist.dentistCode,
          date: dateObj,
          timeSlot,
          slotDuration: 30,
          status: 'available',
          isAvailable: true,
          workingHours: {
            start: `${startHour.toString().padStart(2, '0')}:00`,
            end: `${endHour.toString().padStart(2, '0')}:00`
          }
        }));
        
        try {
          await ScheduleModel.insertMany(slotsToCreate);
          console.log(`✅ Created ${slotsToCreate.length} slots for ${sunday}`);
        } catch (error) {
          if (error.code === 11000) {
            console.log(`✅ Slots already exist for ${sunday} (duplicate key)`);
          } else {
            console.error(`❌ Error creating slots for ${sunday}:`, error.message);
          }
        }
      }
    }
    
    // Verify results
    console.log('\n📊 Verification:');
    const nextSunday = new Date();
    while (nextSunday.getDay() !== 0) {
      nextSunday.setDate(nextSunday.getDate() + 1);
    }
    const sundayStr = nextSunday.toISOString().slice(0, 10);
    
    const allSundaySlots = await ScheduleModel.find({
      date: { $gte: new Date(sundayStr + 'T00:00:00.000Z'), $lt: new Date(sundayStr + 'T23:59:59.999Z') }
    }).sort({ dentistCode: 1, timeSlot: 1 });
    
    console.log(`\n📅 Sunday ${sundayStr} slots:`);
    const slotsByDentist = {};
    allSundaySlots.forEach(slot => {
      if (!slotsByDentist[slot.dentistCode]) {
        slotsByDentist[slot.dentistCode] = [];
      }
      slotsByDentist[slot.dentistCode].push(slot.timeSlot);
    });
    
    Object.entries(slotsByDentist).forEach(([dentistCode, slots]) => {
      console.log(`  ${dentistCode}: ${slots.length} slots (${slots.join(', ')})`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Done! Sunday slots have been generated.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixSundaySlots();

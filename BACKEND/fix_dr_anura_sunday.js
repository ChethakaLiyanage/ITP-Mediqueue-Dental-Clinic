const mongoose = require('mongoose');
const DentistModel = require('./Model/DentistModel');
const { generateSlotsForNext30Days } = require('./utils/scheduleGenerator');

async function fixDrAnuraSunday() {
  try {
    await mongoose.connect('mongodb://localhost:27017/mediqueue');
    console.log('Connected to MongoDB');
    
    // Find Dr. Anura
    const dentists = await DentistModel.find({}).populate('userId', 'name isActive');
    console.log('\n=== Available Dentists ===');
    
    let drAnura = null;
    dentists.forEach(dentist => {
      console.log(`Dentist Code: ${dentist.dentistCode}`);
      console.log(`Name: ${dentist.userId?.name || 'N/A'}`);
      console.log(`Active: ${dentist.userId?.isActive || false}`);
      console.log(`Availability: ${JSON.stringify(dentist.availability_schedule, null, 2)}`);
      console.log('---');
      
      // Look for Dr. Anura by name or use first dentist
      if (dentist.userId?.name && dentist.userId.name.toLowerCase().includes('anura')) {
        drAnura = dentist;
      }
    });
    
    if (!drAnura && dentists.length > 0) {
      drAnura = dentists[0]; // Use first dentist as fallback
      console.log(`\n⚠️ Dr. Anura not found by name, using first dentist: ${drAnura.dentistCode}`);
    }
    
    if (!drAnura) {
      console.log('\n❌ No dentists found in database');
      return;
    }
    
    console.log(`\n🔧 Fixing Sunday availability for Dr. Anura (${drAnura.dentistCode})`);
    
    // Check if Sunday is in availability schedule
    const availability = drAnura.availability_schedule;
    if (availability && availability.Sun) {
      console.log(`✅ Sunday availability found: ${availability.Sun}`);
    } else {
      console.log(`❌ No Sunday availability found in schedule`);
      console.log(`Current schedule:`, availability);
      return;
    }
    
    // Generate slots for the next 30 days
    console.log(`\n🔧 Generating slots for the next 30 days...`);
    const generatedDates = await generateSlotsForNext30Days(drAnura.dentistCode);
    
    console.log(`\n✅ Generated slots for ${generatedDates.length} days`);
    console.log(`📅 Dates: ${generatedDates.join(', ')}`);
    
    // Check if Sunday slots were created
    const ScheduleModel = require('./Model/ScheduleModel');
    const today = new Date();
    const nextSunday = new Date(today);
    
    // Find next Sunday
    while (nextSunday.getDay() !== 0) {
      nextSunday.setDate(nextSunday.getDate() + 1);
    }
    
    const sundayStr = nextSunday.toISOString().slice(0, 10);
    const sundaySlots = await ScheduleModel.find({
      dentistCode: drAnura.dentistCode,
      date: { $gte: new Date(sundayStr + 'T00:00:00.000Z'), $lt: new Date(sundayStr + 'T23:59:59.999Z') }
    }).sort({ timeSlot: 1 });
    
    console.log(`\n📊 Sunday (${sundayStr}) slots: ${sundaySlots.length}`);
    sundaySlots.forEach(slot => {
      console.log(`  - ${slot.timeSlot} (${slot.status})`);
    });
    
    if (sundaySlots.length > 0) {
      console.log(`\n🎉 SUCCESS! Dr. Anura now has ${sundaySlots.length} available slots on Sunday!`);
      console.log(`📝 Patients can now book appointments with Dr. Anura on Sunday.`);
    } else {
      console.log(`\n❌ No Sunday slots were generated. Check the availability schedule format.`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixDrAnuraSunday();

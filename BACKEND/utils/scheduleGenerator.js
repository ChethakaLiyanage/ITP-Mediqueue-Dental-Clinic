const ScheduleService = require('../Services/ScheduleService');
const DentistModel = require('../Model/DentistModel');

/**
 * Generate schedule slots for a dentist based on their availability schedule
 * This should be called when a dentist's availability is updated
 */
async function generateSlotsForDentist(dentistCode, startDate, endDate) {
  try {
    console.log(`🔧 Generating slots for dentist ${dentistCode} from ${startDate} to ${endDate}`);
    
    const dentist = await DentistModel.findOne({ dentistCode }).lean();
    if (!dentist) {
      throw new Error(`Dentist not found: ${dentistCode}`);
    }
    
    if (!dentist.availability_schedule) {
      console.log(`⚠️ No availability schedule found for dentist ${dentistCode}`);
      return;
    }
    
    console.log(`📅 Dentist availability:`, dentist.availability_schedule);
    
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    const generatedDates = [];
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Check if dentist is available on this day
      const daySchedule = dentist.availability_schedule[dayName];
      
      if (daySchedule && daySchedule !== 'Not Available' && daySchedule !== '-') {
        try {
          await ScheduleService.ensureSlotsExist(dentistCode, dateStr);
          generatedDates.push(dateStr);
          console.log(`✅ Generated slots for ${dateStr} (${dayName})`);
        } catch (error) {
          console.error(`❌ Error generating slots for ${dateStr}:`, error.message);
        }
      } else {
        console.log(`⏭️ Skipping ${dateStr} (${dayName}) - not available`);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`🎉 Generated slots for ${generatedDates.length} days: ${generatedDates.join(', ')}`);
    return generatedDates;
    
  } catch (error) {
    console.error('Error generating slots:', error);
    throw error;
  }
}

/**
 * Generate slots for the next 30 days for a dentist
 */
async function generateSlotsForNext30Days(dentistCode) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 30);
  
  return await generateSlotsForDentist(
    dentistCode, 
    today.toISOString().slice(0, 10), 
    endDate.toISOString().slice(0, 10)
  );
}

/**
 * Generate slots for a specific week (including Sunday)
 */
async function generateSlotsForWeek(dentistCode, weekStartDate) {
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  return await generateSlotsForDentist(
    dentistCode, 
    startDate.toISOString().slice(0, 10), 
    endDate.toISOString().slice(0, 10)
  );
}

module.exports = {
  generateSlotsForDentist,
  generateSlotsForNext30Days,
  generateSlotsForWeek
};

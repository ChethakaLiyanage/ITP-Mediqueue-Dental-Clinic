const Dentist = require('../Model/DentistModel');
const ClinicEvent = require('../Model/ClinicEventModel');
const Appointment = require('../Model/AppointmentModel');
const Leave = require('../Model/LeaveModel');
const ScheduleModel = require('../Model/ScheduleModel');
const ScheduleService = require('./ScheduleService');
const { getDayNameUTC } = require('../utils/time');

/**
 * PRIMARY METHOD: Get available slots using ScheduleModel
 * This is now the main method that should be used for all availability checks
 */
async function getBookableSlotsByScheduleModel(dentistCode, dateStr, slotMinutes = 30, excludeAppointmentId = null) {
  console.log('🔍 Using ScheduleModel for availability:', { dentistCode, dateStr, slotMinutes, excludeAppointmentId });
  
  try {
    const targetDate = new Date(dateStr);
    
    // Check if dentist exists and is active
  const dentist = await Dentist.findOne({ dentistCode })
    .populate({ path: 'userId', select: 'name isActive' }).lean();
      
    if (!dentist) {
      throw Object.assign(new Error('Dentist not found'), { status: 404 });
    }
    
    if (!dentist.userId?.isActive) {
      throw Object.assign(new Error('Dentist not active'), { status: 409 });
    }

     // Check dentist's working hours from their profile
  const dayName = getDayNameUTC(dateStr);
     let workingHours = { start: 9, end: 17 }; // Default 9 AM to 5 PM
     let isWorkingDay = true;

     // Debug logging
     console.log(`🔍 ScheduleModel Debug - Dentist: ${dentistCode}, Day: ${dayName}, Date: ${dateStr}`);
     console.log(`🔍 ScheduleModel Debug - targetDate:`, targetDate);
     console.log(`🔍 ScheduleModel Debug - targetDate type:`, typeof targetDate);
     console.log(`🔍 ScheduleModel Debug - availability_schedule:`, dentist.availability_schedule);
     console.log(`🔍 ScheduleModel Debug - daySchedule:`, dentist.availability_schedule?.[dayName]);

     // First, check if dentist works on this day at all
     if (dentist.availability_schedule) {
       const daySchedule = dentist.availability_schedule[dayName];
       
       if (daySchedule) {
         // Check if it's the new object format: { start: '09:00', end: '17:00', available: true }
         if (typeof daySchedule === 'object' && daySchedule.startTime && daySchedule.endTime) {
           if (daySchedule.isWorking) {
             workingHours = {
               start: parseInt(daySchedule.startTime.split(':')[0]),
               end: parseInt(daySchedule.endTime.split(':')[0])
             };
             console.log(`✅ Dentist working hours for ${dayName}: ${daySchedule.startTime}-${daySchedule.endTime}`);
           } else {
             console.log(`❌ Dentist not working on ${dayName}:`, daySchedule);
             return { slots: [], message: `Dentist not working on ${dayName}` };
           }
         }
         // Check if it's the old string format: '09:00-17:00'
         else if (typeof daySchedule === 'string' && daySchedule.includes('-')) {
           const [startTime, endTime] = daySchedule.split('-');
           workingHours = {
             start: parseInt(startTime.split(':')[0]),
             end: parseInt(endTime.split(':')[0])
           };
           console.log(`✅ Dentist working hours for ${dayName}: ${daySchedule}`);
         }
         // Check if it's 'Not Available' or similar
         else if (typeof daySchedule === 'string' && (daySchedule.toLowerCase().includes('not') || daySchedule === '-')) {
           console.log(`❌ Dentist not working on ${dayName}: ${daySchedule}`);
           return { slots: [], message: `Dentist not working on ${dayName}` };
         }
       } else {
         console.log(`⚠️ No schedule defined for ${dayName}, using default hours 9-17`);
       }
     } else {
       console.log(`⚠️ No availability_schedule found, using default hours 9-17`);
     }

    // Query ScheduleModel directly for available slots
    const dateStart = new Date(targetDate);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(targetDate);
    dateEnd.setUTCHours(23, 59, 59, 999);

    console.log(`🔍 Querying ScheduleModel for available slots:`, {
      dentistCode,
      dateStart: dateStart.toISOString(),
      dateEnd: dateEnd.toISOString(),
      workingHours: `${workingHours.start}:00-${workingHours.end}:00`
    });

    const availableSlots = await ScheduleModel.find({
      dentistCode: dentistCode,
      date: { $gte: dateStart, $lte: dateEnd },
      status: 'available',
      isAvailable: true
    }).sort({ timeSlot: 1 }).lean();

     console.log(`🔍 Found ${availableSlots.length} available slots in ScheduleModel`);

     if (availableSlots.length === 0) {
       console.log(`⚠️ No available slots found in ScheduleModel for ${dentistCode} on ${dateStr}`);
       console.log(`🔄 This might be because slots haven't been created yet. Let's try fallback method.`);
       // Don't throw error, let the main function handle fallback
       return { slots: [], message: "No slots in ScheduleModel - using fallback" };
     }

     // Transform ScheduleModel slots to the expected format
     // Filter slots based on dentist's working hours
     const bookableSlots = availableSlots
       .filter(slot => {
         const [startTime, endTime] = slot.timeSlot.split('-');
         const [startHour] = startTime.split(':').map(Number);
         const [endHour] = endTime.split(':').map(Number);
         
         // Only include slots that are completely within working hours
         const isWithinWorkingHours = startHour >= workingHours.start && endHour <= workingHours.end;
         
         if (!isWithinWorkingHours) {
           console.log(`⚠️ Slot ${slot.timeSlot} outside working hours (${workingHours.start}:00-${workingHours.end}:00)`);
         }
         
         return isWithinWorkingHours;
       })
       .map(slot => {
        const [startTime, endTime] = slot.timeSlot.split('-');
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        const slotStart = new Date(targetDate);
        slotStart.setUTCHours(startHour, startMin, 0, 0);
        
        const slotEnd = new Date(targetDate);
        slotEnd.setUTCHours(endHour, endMin, 0, 0);

  return {
          start: slotStart,
          end: slotEnd,
          status: 'bookable',
          timeSlot: slot.timeSlot,
          slotDuration: slot.slotDuration
        };
      });

    console.log(`✅ Returning ${bookableSlots.length} bookable slots from ScheduleModel`);
    return { slots: bookableSlots };
    
  } catch (error) {
    console.error('❌ Error in getBookableSlotsByScheduleModel:', error);
    return { slots: [], message: error.message };
  }
}

/**
 * LEGACY METHOD: Get available slots using old logic (kept as fallback)
 * This method is deprecated and should only be used if ScheduleModel fails
 */
async function getBookableSlotsByCodes(dentistCode, dateStr, slotMinutes = 30, excludeAppointmentId = null) {
  console.log(`🔍 getBookableSlotsByCodes (legacy fallback) called: ${dentistCode}, ${dateStr}, ${slotMinutes}min, exclude: ${excludeAppointmentId}`);
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    // Get dentist availability schedule
    const dentist = await Dentist.findOne({ dentistCode }).lean();
    if (!dentist) {
      console.log(`❌ Dentist not found: ${dentistCode}`);
      return { slots: [], message: "Dentist not found" };
    }

    // Skip leave checking in fallback - only use ScheduleModel for leave blocking
    // const isOnLeave = await Leave.isDentistOnLeave(dentistCode, date);
    // if (isOnLeave) {
    //   console.log(`❌ Dentist is on leave: ${dentistCode}`);
    //   return { slots: [], message: "Dentist is on leave" };
    // }

     // Get working hours for the day
     const dayName = getDayNameUTC(dateStr);
     let workingHours = { start: 9, end: 17 }; // Default 9 AM to 5 PM

     // Debug logging
     console.log(`🔍 Fallback Debug - Dentist: ${dentistCode}, Day: ${dayName}, Date: ${dateStr}`);
     console.log(`🔍 Fallback Debug - availability_schedule:`, dentist.availability_schedule);
     console.log(`🔍 Fallback Debug - daySchedule:`, dentist.availability_schedule?.[dayName]);

     // First, check if dentist works on this day at all
     if (dentist.availability_schedule && dentist.availability_schedule[dayName]) {
       const daySchedule = dentist.availability_schedule[dayName];
       
       // Check if it's the new object format: { start: '09:00', end: '17:00', available: true }
       if (typeof daySchedule === 'object' && daySchedule.startTime && daySchedule.endTime) {
         if (daySchedule.isWorking) {
           workingHours = {
             start: parseInt(daySchedule.startTime.split(':')[0]),
             end: parseInt(daySchedule.endTime.split(':')[0])
           };
           console.log(`✅ Fallback - Dentist working hours for ${dayName}: ${daySchedule.startTime}-${daySchedule.endTime}`);
         } else {
           console.log(`❌ Fallback - Dentist not working on ${dayName}:`, daySchedule);
           return { slots: [], message: `Dentist not working on ${dayName}` };
         }
       }
       // Check if it's the old string format: '09:00-17:00'
       else if (typeof daySchedule === 'string' && daySchedule.includes('-')) {
         const [startTime, endTime] = daySchedule.split('-');
         workingHours = {
           start: parseInt(startTime.split(':')[0]),
           end: parseInt(endTime.split(':')[0])
         };
         console.log(`✅ Fallback - Dentist working hours for ${dayName}: ${daySchedule}`);
       }
       // Check if it's 'Not Available' or similar
       else if (typeof daySchedule === 'string' && (daySchedule.toLowerCase().includes('not') || daySchedule === '-')) {
         console.log(`❌ Fallback - Dentist not working on ${dayName}: ${daySchedule}`);
         return { slots: [], message: `Dentist not working on ${dayName}` };
       }
     } else {
       // If no schedule defined for this day, check if dentist has any schedule at all
       if (dentist.availability_schedule && Object.keys(dentist.availability_schedule).length > 0) {
         console.log(`❌ Fallback - No schedule defined for ${dayName}, dentist not working on this day`);
         return { slots: [], message: `Dentist not working on ${dayName}` };
       } else {
         console.log(`⚠️ Fallback - No availability_schedule found, using default hours`);
       }
     }

    // Skip clinic event checking in fallback - only use ScheduleModel for event blocking
    // const clinicEvents = await ClinicEvent.find({
    //   startDate: { $lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) }, // End of day
    //   endDate: { $gte: date }, // Start of day
    //   isDeleted: { $ne: true }
    // }).lean();

    // if (clinicEvents.length > 0) {
    //   console.log(`❌ Clinic events found that block the day:`, clinicEvents.map(e => e.title));
    //   return { slots: [], message: "Clinic events block this day" };
    // }

    // Generate time slots
    const slots = [];
    const slotDuration = slotMinutes;
    
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, min, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
        
        // Skip if slot goes beyond working hours
        if (slotEnd.getHours() > workingHours.end || 
            (slotEnd.getHours() === workingHours.end && slotEnd.getMinutes() > 0)) {
          continue;
        }

        // Skip appointment conflict checking in fallback - ScheduleModel handles this
        // const conflictingAppointment = await Appointment.findOne({
        //   _id: excludeAppointmentId ? { $ne: excludeAppointmentId } : { $exists: true },
        //   dentist_code: dentistCode,
        //   appointment_date: {
        //     $gte: slotStart,
        //     $lt: slotEnd
        //   },
        //   status: { $in: ["pending", "confirmed"] }
        // }).lean();

        // if (!conflictingAppointment) {
        slots.push({
          start: slotStart,
          end: slotEnd,
          status: 'bookable',
          iso: slotStart.toISOString()
        });
        // }
      }
    }

    console.log(`✅ Generated ${slots.length} available slots for ${dentistCode} on ${dateStr} (legacy method)`);
    return { slots };
  } catch (error) {
    console.error(`❌ Error in getBookableSlotsByCodes:`, error);
    return { slots: [], message: error.message };
  }
}

/**
 * MAIN ENTRY POINT: Get available slots with ScheduleModel priority
 * This function tries ScheduleModel first, falls back to legacy method if needed
 */
async function getAvailableSlots(dentistCode, dateStr, slotMinutes = 30, excludeAppointmentId = null) {
  console.log(`🔍 getAvailableSlots called: ${dentistCode}, ${dateStr}, ${slotMinutes}min, exclude: ${excludeAppointmentId}`);
  
   // Try ScheduleModel first
   try {
     const result = await getBookableSlotsByScheduleModel(dentistCode, dateStr, slotMinutes, excludeAppointmentId);
     
     // If ScheduleModel has slots, use them
     if (result.slots && result.slots.length > 0) {
       console.log(`✅ Using ScheduleModel result: ${result.slots.length} slots`);
       return result;
     }
     
     // If no slots from ScheduleModel, try fallback
     console.log('⚠️ No slots from ScheduleModel, trying fallback method');
     const fallbackResult = await getBookableSlotsByCodes(dentistCode, dateStr, slotMinutes, excludeAppointmentId);
     
     if (fallbackResult.slots && fallbackResult.slots.length > 0) {
       console.log(`✅ Using fallback result: ${fallbackResult.slots.length} slots`);
       return fallbackResult;
     }
     
     // Both methods failed - return the message from the last attempt
     console.log('❌ Both ScheduleModel and fallback methods returned no slots');
     return fallbackResult || result || { slots: [], message: "No available slots found" };
     
   } catch (scheduleError) {
     console.log('⚠️ ScheduleModel failed, using fallback method:', scheduleError.message);
     
     try {
       const fallbackResult = await getBookableSlotsByCodes(dentistCode, dateStr, slotMinutes, excludeAppointmentId);
       return fallbackResult;
     } catch (fallbackError) {
       console.error('❌ Both ScheduleModel and fallback methods failed:', fallbackError.message);
       return { slots: [], message: "Availability check failed" };
     }
   }
}

module.exports = {
  getAvailableSlots,
  getBookableSlotsByScheduleModel,
  getBookableSlotsByCodes
};
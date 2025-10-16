// Service to manage ScheduleModel updates
const ScheduleModel = require('../Model/ScheduleModel');
const { getDayNameUTC } = require('../utils/time');

class ScheduleService {
  
  /**
   * Generate time slots for a date range
   */
  static generateTimeSlots(startHour, endHour, slotDuration) {
    const slots = [];
    let currentHour = startHour;
    let currentMin = 0;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin === 0)) {
      const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      currentMin += slotDuration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
      
      const endTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      if (currentHour < endHour || (currentHour === endHour && currentMin === 0)) {
        slots.push(`${startTime}-${endTime}`);
      }
    }
    
    return slots;
  }

  /**
   * Ensure slots exist for a dentist on a specific date
   */
  static async ensureSlotsExist(dentistCode, date, workingHours = null, slotDuration = 30) {
    // If workingHours not provided, get from dentist's profile
    if (!workingHours) {
      const Dentist = require('../Model/DentistModel');
      const { getDayNameUTC } = require('../utils/time');
      
      const dentist = await Dentist.findOne({ dentistCode }).lean();
      if (!dentist) {
        throw new Error(`Dentist not found: ${dentistCode}`);
      }
      
      const dateObj = new Date(date + 'T00:00:00.000Z');
      const dayName = getDayNameUTC(dateObj);
      
      // Get working hours from dentist's availability_schedule
      if (dentist.availability_schedule && dentist.availability_schedule[dayName]) {
        const daySchedule = dentist.availability_schedule[dayName];
        
        // Check if it's the new object format: { start: '09:00', end: '17:00', available: true }
        if (typeof daySchedule === 'object' && daySchedule.startTime && daySchedule.endTime) {
          if (daySchedule.isWorking) {
            workingHours = {
              start: parseInt(daySchedule.startTime.split(':')[0]),
              end: parseInt(daySchedule.endTime.split(':')[0])
            };
            console.log(`✅ Using dentist's working hours for ${dayName}: ${daySchedule.startTime}-${daySchedule.endTime}`);
          } else {
            console.log(`⚠️ Dentist not working on ${dayName}, skipping slot creation`);
            return; // Don't create slots if dentist doesn't work on this day
          }
        }
        // Check if it's the old string format: '09:00-17:00'
        else if (typeof daySchedule === 'string' && daySchedule.includes('-')) {
          const [startTime, endTime] = daySchedule.split('-');
          workingHours = {
            start: parseInt(startTime.split(':')[0]),
            end: parseInt(endTime.split(':')[0])
          };
          console.log(`✅ Using dentist's working hours for ${dayName}: ${daySchedule}`);
        }
        // Check if it's 'Not Available' or similar
        else if (typeof daySchedule === 'string' && (daySchedule.toLowerCase().includes('not') || daySchedule === '-')) {
          console.log(`⚠️ Dentist not working on ${dayName}: ${daySchedule}, skipping slot creation`);
          return; // Don't create slots if dentist doesn't work on this day
        }
      } else {
        workingHours = { start: 9, end: 17 }; // Default hours
        console.log(`⚠️ No schedule defined for ${dayName}, using default hours 9-17`);
      }
    }
    
    // Ensure we're working with the correct date (local timezone)
    const dateObj = new Date(date + 'T00:00:00.000Z'); // Force UTC midnight for the date
    const timeSlots = this.generateTimeSlots(workingHours.start, workingHours.end, slotDuration);
    
    console.log(`🔧 Ensuring slots exist for ${dentistCode} on ${date} (${timeSlots.length} slots, ${workingHours.start}:00-${workingHours.end}:00)`);
    
    // Use upsert with unique constraint to prevent duplicates atomically
    try {
      // Try to create all slots at once using insertMany with ordered: false
      const slotsToCreate = timeSlots.map(timeSlot => ({
        dentistCode,
        date: dateObj,
        timeSlot,
        slotDuration,
        status: 'available',
        isAvailable: true,
        workingHours: {
          start: `${workingHours.start.toString().padStart(2, '0')}:00`,
          end: `${workingHours.end.toString().padStart(2, '0')}:00`
        }
      }));
      
      await ScheduleModel.insertMany(slotsToCreate, { ordered: false });
      console.log(`✅ Created ${timeSlots.length} slots for ${dentistCode} on ${date}`);
      
    } catch (error) {
      // If duplicates exist, that's fine - slots already exist
      if (error.code === 11000) { // Duplicate key error
        console.log(`✅ Slots already exist for ${dentistCode} on ${date} (duplicate key ignored)`);
        return;
      }
      throw error;
    }
  }

  /**
   * Block slots for a date range (for leave or events)
   */
  static async blockSlots(dentistCode, startDate, endDate, blockedBy, blockingId, blockingReason, lastModifiedBy) {
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    console.log(`🚫 Blocking slots for ${dentistCode} from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)} (${blockedBy})`);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      
      // Only ensure slots exist if they don't already exist
      const existingSlots = await ScheduleModel.countDocuments({
        dentistCode,
        date: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(dateStr + 'T23:59:59.999Z') }
      });
      
      if (existingSlots === 0) {
        console.log(`📅 Creating slots for ${dentistCode} on ${dateStr} before blocking`);
        await this.ensureSlotsExist(dentistCode, dateStr);
      }
      
      // Block all slots for this date (both available and any existing ones)
      const updateResult = await ScheduleModel.updateMany(
        {
          dentistCode,
          date: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(dateStr + 'T23:59:59.999Z') }
        },
        {
          status: `blocked_${blockedBy}`,
          isAvailable: false,
          blockedBy: blockedBy,
          blockingId: blockingId,
          blockingReason: blockingReason,
          lastModifiedBy: lastModifiedBy
        }
      );
      
      console.log(`🚫 Blocked ${updateResult.modifiedCount} slots for ${dentistCode} on ${dateStr} (${blockedBy})`);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  /**
   * Unblock slots for a date range
   */
  static async unblockSlots(dentistCode, startDate, endDate, lastModifiedBy) {
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    console.log(`✅ Unblocking slots for ${dentistCode} from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      
      // Unblock all blocked slots for this date
      const updateResult = await ScheduleModel.updateMany(
        {
          dentistCode,
          date: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(dateStr + 'T23:59:59.999Z') },
          status: { $in: ['blocked_leave', 'blocked_event', 'blocked_maintenance'] }
        },
        {
          status: 'available',
          isAvailable: true,
          blockedBy: undefined,
          blockingId: undefined,
          blockingReason: undefined,
          lastModifiedBy: lastModifiedBy
        }
      );
      
      console.log(`✅ Unblocked ${updateResult.modifiedCount} slots for ${dentistCode} on ${dateStr}`);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  /**
   * Book a specific slot (atomic operation with conflict checking)
   */
  static async bookSlot(dentistCode, appointmentDate, appointmentId, patientCode, reason, createdBy) {
    const dateObj = new Date(appointmentDate);
    const dateStr = appointmentDate.toISOString().slice(0, 10);
    
    console.log(`🔍 Attempting to book slot for ${dentistCode} on ${dateStr} at ${appointmentDate.toISOString().slice(11, 16)}`);
    
    // Ensure slots exist first
    await this.ensureSlotsExist(dentistCode, dateStr);
    
    // Convert appointment time to local timezone for matching
    const appointmentLocalTime = new Date(appointmentDate);
    const appointmentTime = appointmentLocalTime.toTimeString().slice(0, 5); // HH:MM in local time
    const appointmentHour = parseInt(appointmentTime.split(':')[0]);
    const appointmentMin = parseInt(appointmentTime.split(':')[1]);
    
    console.log(`🔍 Looking for slot matching time: ${appointmentTime} (${appointmentHour}:${appointmentMin})`);
    console.log(`🔍 Appointment UTC: ${appointmentDate.toISOString()}`);
    console.log(`🔍 Appointment Local: ${appointmentLocalTime.toString()}`);
    console.log(`🔍 Target date: ${dateStr}`);
    
    // Find the slot that contains this time
    // Use date string for exact matching to avoid timezone issues
    const slots = await ScheduleModel.find({
      dentistCode,
      date: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(dateStr + 'T23:59:59.999Z') },
      status: 'available'
    });
    
    console.log(`🔍 Found ${slots.length} available slots for ${dentistCode} on ${dateStr}:`);
    slots.forEach(slot => console.log(`  - ${slot.timeSlot} (${slot.status})`));
    
    if (slots.length === 0) {
      console.log(`❌ No available slots found for ${dentistCode} on ${dateStr}`);
      throw new Error(`No available slots found for ${dentistCode} on ${dateStr}`);
    }
    
    for (const slot of slots) {
      const [startTime, endTime] = slot.timeSlot.split('-');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      // Check if appointment time falls within this slot
      const slotStartMinutes = startHour * 60 + startMin;
      const slotEndMinutes = endHour * 60 + endMin;
      const appointmentMinutes = appointmentHour * 60 + appointmentMin;
      
      console.log(`🔍 Checking slot ${slot.timeSlot}: ${slotStartMinutes}min - ${slotEndMinutes}min vs appointment ${appointmentMinutes}min`);
      
      if (appointmentMinutes >= slotStartMinutes && appointmentMinutes < slotEndMinutes) {
        console.log(`✅ Found matching slot: ${slot.timeSlot}`);
        
        // Use findOneAndUpdate for atomic booking with conflict checking
        const updatedSlot = await ScheduleModel.findOneAndUpdate(
          { 
            _id: slot._id, 
            status: 'available' // Only update if still available
          },
          {
            status: 'booked',
            isAvailable: false,
            appointmentId: appointmentId.toString(),
            patientCode: patientCode,
            reason: reason,
            lastModifiedBy: createdBy
          },
          { new: true }
        );
        
        if (!updatedSlot) {
          console.log(`❌ Slot ${slot.timeSlot} was taken by another user`);
          throw new Error(`Slot ${slot.timeSlot} is no longer available for ${dentistCode} at ${dateStr}`);
        }
        
        console.log(`📅 Successfully booked slot: ${dentistCode} ${dateStr} ${slot.timeSlot} for appointment ${appointmentId}`);
        return updatedSlot;
      }
    }
    
    console.log(`❌ No matching slot found for appointment time ${appointmentTime}`);
    throw new Error(`No available slot found for ${dentistCode} at ${appointmentDate}`);
  }

  /**
   * Cancel a booking (free the slot)
   */
  static async cancelBooking(dentistCode, appointmentDate, appointmentId, lastModifiedBy) {
    const dateObj = new Date(appointmentDate);
    
    const slot = await ScheduleModel.findOne({
      dentistCode,
      date: dateObj,
      appointmentId,
      status: 'booked'
    });
    
    if (slot) {
      await slot.freeSlot(lastModifiedBy);
      console.log(`❌ Cancelled booking: ${dentistCode} ${appointmentDate.toISOString().slice(0, 10)} ${slot.timeSlot}`);
      return slot;
    }
    
    throw new Error(`No booked slot found for appointment ${appointmentId}`);
  }

  /**
   * Get available slots for a dentist on a specific date
   */
  static async getAvailableSlots(dentistCode, date) {
    const dateStr = date.toISOString().slice(0, 10);
    // Use date range query to avoid timezone issues
    return await ScheduleModel.find({
      dentistCode,
      date: { $gte: new Date(dateStr + 'T00:00:00.000Z'), $lt: new Date(dateStr + 'T23:59:59.999Z') },
      isAvailable: true,
      status: 'available'
    }).sort({ timeSlot: 1 });
  }

  /**
   * Get all slots for a dentist on a specific date
   */
  static async getAllSlots(dentistCode, date) {
    const dateObj = new Date(date);
    return await ScheduleModel.getAllSlots(dentistCode, dateObj);
  }

  /**
   * Check if a specific time slot is available
   */
  static async isSlotAvailable(dentistCode, appointmentDate) {
    const dateObj = new Date(appointmentDate);
    const appointmentLocalTime = new Date(appointmentDate);
    const appointmentTime = appointmentLocalTime.toTimeString().slice(0, 5); // HH:MM in local time
    const appointmentHour = parseInt(appointmentTime.split(':')[0]);
    const appointmentMin = parseInt(appointmentTime.split(':')[1]);
    
    const slots = await ScheduleModel.find({
      dentistCode,
      date: dateObj,
      status: 'available'
    });
    
    for (const slot of slots) {
      const [startTime, endTime] = slot.timeSlot.split('-');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const slotStartMinutes = startHour * 60 + startMin;
      const slotEndMinutes = endHour * 60 + endMin;
      const appointmentMinutes = appointmentHour * 60 + appointmentMin;
      
      if (appointmentMinutes >= slotStartMinutes && appointmentMinutes < slotEndMinutes) {
        return true;
      }
    }
    
    return false;
  }
}

module.exports = ScheduleService;

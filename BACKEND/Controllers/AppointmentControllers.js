const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Appointment = require("../Model/AppointmentModel");
const OtpToken = require("../Model/OtpToken");
const Patient = require("../Model/PatientModel");
const Dentist = require("../Model/DentistModel");
const User = require("../Model/User");
const Leave = require("../Model/LeaveModel");
const ScheduleService = require("../Services/ScheduleService"); // RE-ENABLED for new data only
const { sendSms, normalizePhone } = require("../utils/sms");

const OTP_EXPIRY_MS = Number(process.env.APPOINTMENT_OTP_EXPIRY_MS || 5 * 60 * 1000);
const OTP_MESSAGE_PREFIX = process.env.APPOINTMENT_OTP_SMS_PREFIX || "Your Medi Queue verification code is";

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveDentistCode({ dentistCode, doctorId }) {
  if (dentistCode) return { dentistCode };
  if (!doctorId) return { dentistCode: null };

  const dentist = await Dentist.findById(doctorId).lean();
  if (!dentist) return { dentistCode: doctorId, dentistName: null };

  return {
    dentistCode: dentist.dentistCode || dentist._id.toString(),
    dentistName: dentist.name,
  };
}

// Get available appointment slots for a dentist
const getAvailableSlots = async (req, res) => {
  try {
    const { dentistCode, doctorId, date, durationMinutes = 30 } = req.query;
    
    // Accept both dentistCode and doctorId for frontend compatibility
    const finalDentistCode = dentistCode || doctorId;
    
    if (!finalDentistCode) {
      return res.status(400).json({ message: "dentistCode or doctorId is required" });
    }
    
    if (!date) {
      return res.status(400).json({ message: "date is required (YYYY-MM-DD format)" });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Get dentist info - handle both dentistCode and _id
    let dentist;
    console.log('🔍 Dentist lookup:', { finalDentistCode, isObjectId: finalDentistCode.match(/^[0-9a-fA-F]{24}$/) });
    
    if (finalDentistCode.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId
      dentist = await Dentist.findById(finalDentistCode).populate('userId', 'name').lean();
      console.log('🔍 Found dentist by ObjectId:', { found: !!dentist, dentistCode: dentist?.dentistCode });
    } else {
      // It's a dentistCode string
      dentist = await Dentist.findOne({ dentistCode: finalDentistCode }).populate('userId', 'name').lean();
      console.log('🔍 Found dentist by dentistCode:', { found: !!dentist, dentistCode: dentist?.dentistCode });
    }

    if (!dentist) {
      console.log('❌ Dentist not found:', finalDentistCode);
      return res.status(404).json({ message: "Dentist not found" });
    }

    // Use the ScheduleModel for clean slot checking
    const { getAvailableSlots } = require("../Services/AvailabilityService");
    
    try {
      console.log('🔍 Getting bookable slots for:', {
        dentistCode: dentist.dentistCode,
        date: date,
        durationMinutes: durationMinutes,
        endpoint: 'getAvailableSlots'
      });
      
      // Use simplified AvailabilityService (handles ScheduleModel with fallback internally)
      const result = await getAvailableSlots(dentist.dentistCode, date, parseInt(durationMinutes));
      
      console.log('🔍 AvailabilityService result:', {
        slotsCount: result.slots.length,
        isOnLeave: result.isOnLeave,
        workingWindow: result.workingWindow,
        firstFewSlots: result.slots.slice(0, 3).map(s => ({
          start: s.start.toISOString(),
          status: s.status
        }))
      });
      
      // Transform the result to match frontend expectations
      const transformedSlots = result.slots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        status: slot.status === 'bookable' ? 'available' : slot.status,
        dentistCode: dentist.dentistCode,
        dentistName: dentist.userId?.name,
        specialization: dentist.specialization,
        time: slot.start.toISOString(),
        iso: slot.start.toISOString(), // Add iso field for frontend compatibility
        displayTime: slot.start.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      }));

      return res.status(200).json({
        slots: transformedSlots,
        availableSlots: transformedSlots, // For backward compatibility
        date: date,
        dentistCode: dentist.dentistCode,
        dentistName: dentist.userId?.name,
        dentist: {
          dentistCode: dentist.dentistCode,
          name: dentist.userId?.name,
          specialization: dentist.specialization
        },
        workingWindow: result.workingWindow,
        slotMinutes: result.slotMinutes,
        totalSlots: transformedSlots.length,
        onLeave: result.isOnLeave || false
      });

    } catch (availabilityError) {
      console.error("AvailabilityService error:", availabilityError);
      
      // Fallback: Check if dentist is on leave
      const isOnLeave = await Leave.isDentistOnLeave(dentist.dentistCode, targetDate);
      if (isOnLeave) {
        return res.status(200).json({
          slots: [],
          availableSlots: [],
          message: "Dentist is on leave for this date",
          dentist: {
            dentistCode: dentist.dentistCode,
            name: dentist.userId?.name,
            specialization: dentist.specialization
          },
          onLeave: true
        });
      }

      // Return empty slots if availability service fails
      return res.status(200).json({
        slots: [],
        availableSlots: [],
        message: "Unable to determine available slots",
        dentist: {
          dentistCode: dentist.dentistCode,
          name: dentist.userId?.name,
          specialization: dentist.specialization
        },
        onLeave: false
      });
    }

  } catch (error) {
    console.error("getAvailableSlots error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// Registered user appointment booking (requires authentication)
const bookAppointment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const { 
      dentist_code, 
      appointment_date, 
      reason, 
      queue_no,
      // "Book for someone else" fields
      bookingForSomeoneElse,
      otherPersonDetails
    } = req.body || {};
    
    // Get patient code from authenticated user (the booker)
    const bookerPatientCode = req.user?.patientCode;
    if (!bookerPatientCode) {
      return res.status(400).json({ message: "Patient profile not found. Please complete your registration." });
    }

    if (!dentist_code) return res.status(400).json({ message: "dentist_code is required" });

    const appointmentDate = toDate(appointment_date);
    if (!appointmentDate) {
      return res.status(400).json({ message: "appointment_date must be a valid ISO datetime" });
    }

    // Check if dentist is on leave for this date
    const isOnLeave = await Leave.isDentistOnLeave(dentist_code, appointmentDate);
    if (isOnLeave) {
      return res.status(400).json({ 
        message: "Cannot book appointment. Dentist is not available on this date." 
      });
    }

    // Note: We no longer check AppointmentModel for conflicts
    // ScheduleModel is the single source of truth for availability
    // The ScheduleService.bookSlot() call below will handle conflict checking

    // Prepare appointment data
    const appointmentData = {
      dentist_code,
      appointment_date: appointmentDate,
      reason: reason?.trim() || "",
      status: "pending", // Always set as pending for new bookings
      queue_no,
      isGuestBooking: false
    };

    // Handle "booking for someone else"
    if (bookingForSomeoneElse && otherPersonDetails) {
      // Validate other person's details
      if (!otherPersonDetails.name?.trim()) {
        return res.status(400).json({ message: "Other person's name is required" });
      }
      if (!otherPersonDetails.contact?.trim()) {
        return res.status(400).json({ message: "Other person's contact is required" });
      }

      appointmentData.isBookingForSomeoneElse = true;
      appointmentData.bookerPatientCode = bookerPatientCode;
      appointmentData.otherPersonDetails = {
        name: otherPersonDetails.name.trim(),
        contact: otherPersonDetails.contact.trim(),
        age: otherPersonDetails.age ? parseInt(otherPersonDetails.age) : undefined,
        gender: otherPersonDetails.gender || '',
        relation: otherPersonDetails.relation?.trim() || '',
        notes: otherPersonDetails.notes?.trim() || ''
      };

      // Try to find if the other person is already a registered patient by contact
      // This is for future linking capability
      const existingPatient = await Patient.findOne({ 
        $or: [
          { phone: otherPersonDetails.contact.trim() },
          { email: otherPersonDetails.contact.trim() }
        ]
      }).lean();

      if (existingPatient) {
        appointmentData.appointmentForPatientCode = existingPatient.patientCode;
      }
    } else {
      // Regular booking for self
      appointmentData.patient_code = bookerPatientCode;
    }

    // Create appointment
    const doc = await Appointment.create(appointmentData);

    // Auto-update ScheduleModel - book the slot
    try {
      await ScheduleService.bookSlot(
        dentist_code,
        appointmentDate,
        doc._id.toString(),
        doc.isBookingForSomeoneElse ? (doc.appointmentForPatientCode || doc.bookerPatientCode) : doc.patient_code,
        reason?.trim() || "Appointment",
        bookerPatientCode
      );
      console.log(`✅ Updated ScheduleModel for appointment: ${doc.appointmentCode}`);
    } catch (scheduleError) {
      console.error(`❌ Failed to book slot in ScheduleModel for appointment ${doc.appointmentCode}:`, scheduleError.message);
      
      // If slot booking fails, delete the appointment and return error
      await Appointment.findByIdAndDelete(doc._id);
      
      if (scheduleError.message.includes('no longer available')) {
        return res.status(409).json({
          message: "This time slot is no longer available. Please select a different time.",
          conflictOn: ["dentist_code", "appointment_date"],
        });
      }
      
      return res.status(500).json({
        message: "Failed to book appointment slot. Please try again.",
        error: scheduleError.message
      });
    }

    // ✅ Auto-create queue entry for today's appointments (direct to queue)
    const isToday = "2025-10-17"; // Hardcoded to match queue system
    const appointmentDateStr = appointmentDate.toISOString().split('T')[0];
    
    if (appointmentDateStr === isToday) {
      // Import Queue model
      const Queue = require("../Model/QueueModel");
      
      // Check if queue entry already exists to prevent duplicates
      const existingQueue = await Queue.findOne({
        appointmentCode: doc.appointmentCode
      });
      
      if (!existingQueue) {
        // Get next position for this dentist
        const lastQueue = await Queue.findOne({ 
          dentistCode: doc.dentist_code,
          date: { $gte: new Date(`${isToday}T00:00:00Z`), $lte: new Date(`${isToday}T23:59:59Z`) }
        }).sort({ position: -1 }).limit(1);
        
        const nextPosition = lastQueue ? lastQueue.position + 1 : 1;
        
        // Determine patient code for queue
        const queuePatientCode = doc.isBookingForSomeoneElse 
          ? (doc.appointmentForPatientCode || doc.bookerPatientCode || 'TEMP')
          : doc.patient_code;
        
        // Create queue entry directly
        await Queue.create({
          appointmentCode: doc.appointmentCode,
          patientCode: queuePatientCode,
          dentistCode: doc.dentist_code,
          date: doc.appointment_date,
          position: nextPosition,
          status: 'waiting',
          reason: doc.reason || 'General consultation'
        });
        
        // ✅ Remove appointment from appointment table since it's now in queue
        await Appointment.deleteOne({ appointmentCode: doc.appointmentCode });
        
        console.log('✅ Auto-created queue entry and removed appointment for today\'s appointment:', doc.appointmentCode);
      } else {
        console.log('✅ Queue entry already exists for appointment:', doc.appointmentCode);
        // ✅ Still remove appointment from appointment table if queue exists
        await Appointment.deleteOne({ appointmentCode: doc.appointmentCode });
      }
      
      return res.status(201).json({ 
        message: "Appointment booked and added to today's queue.",
        appointment: doc,
        autoQueued: true
      });
    }

    return res.status(201).json({ 
      message: "Appointment booked successfully. Awaiting receptionist confirmation.",
      appointment: doc 
    });
  } catch (err) {
    // Note: We no longer handle MongoDB duplicate key errors here
    // ScheduleModel is the single source of truth for availability checking

    return res.status(500).json({ message: err.message });
  }
};

// Guest user appointment booking (no authentication required)
const bookGuestAppointment = async (req, res) => {
  try {
    const { 
      dentist_code, 
      appointment_date, 
      reason, 
      queue_no,
      // Guest information
      name,
      phone,
      email,
      address,
      age,
      gender
    } = req.body || {};

    // Validate required fields for guest booking
    if (!dentist_code) return res.status(400).json({ message: "dentist_code is required" });
    if (!name) return res.status(400).json({ message: "name is required" });
    if (!phone) return res.status(400).json({ message: "phone is required" });
    if (!email) return res.status(400).json({ message: "email is required" });

    const appointmentDate = toDate(appointment_date);
    if (!appointmentDate) {
      return res.status(400).json({ message: "appointment_date must be a valid ISO datetime" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9]{9,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ message: "Please provide a valid phone number" });
    }

    // Use ScheduleModel for comprehensive schedule checking
    const { getAvailableSlots } = require("../Services/AvailabilityService");
    
    try {
      const dateStr = appointmentDate.toISOString().slice(0, 10);
      console.log('🔍 Guest booking validation:', {
        dentist_code,
        appointmentDate: appointmentDate.toISOString(),
        dateStr
      });
      
      // Use simplified AvailabilityService (handles ScheduleModel with fallback internally)
      const result = await getAvailableSlots(dentist_code, dateStr, 30);
      
      console.log('🔍 Guest booking availability result:', {
        slotsCount: result.slots.length,
        isOnLeave: result.isOnLeave,
        requestedTime: appointmentDate.getTime(),
        availableSlots: result.slots.map(s => ({
          start: s.start.toISOString(),
          status: s.status
        }))
      });
      
      // Check if the requested time slot is available
      const requestedTime = appointmentDate.getTime();
      const availableSlot = result.slots.find(slot => 
        slot.start.getTime() === requestedTime && slot.status === 'bookable'
      );
      
      if (!availableSlot) {
        console.log('❌ Slot validation failed - slot not available:', {
          requestedTime,
          availableSlots: result.slots.map(s => ({
            start: s.start.getTime(),
            status: s.status
          }))
        });
        
        return res.status(409).json({
          message: "This time slot is not available. It may be booked, blocked by a clinic event, or outside working hours.",
          conflictOn: ["dentist_code", "appointment_date"],
        });
      }
      
    } catch (scheduleError) {
      console.error("Schedule validation error:", scheduleError);
      
      // Fallback to basic checks
      const isOnLeave = await Leave.isDentistOnLeave(dentist_code, appointmentDate);
      if (isOnLeave) {
        return res.status(400).json({ 
          message: "Cannot book appointment. Dentist is not available on this date." 
        });
      }

      // Note: We no longer check AppointmentModel for conflicts in fallback
      // ScheduleModel is the single source of truth for availability
    }

    // Create guest appointment
    const appointmentData = {
      dentist_code,
      appointment_date: appointmentDate,
      reason: reason?.trim() || "",
      status: "pending", // Always set as pending for new bookings
      queue_no,
      isGuestBooking: true,
      guestInfo: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address?.trim(),
        age: age ? parseInt(age) : undefined,
        gender: gender && gender.trim() ? gender.toLowerCase() : undefined
      }
    };
    
    const doc = await Appointment.create(appointmentData);

    // Auto-update ScheduleModel - book the slot
    try {
        await ScheduleService.bookSlot(
          dentist_code,
          appointmentDate,
          doc._id.toString(),
          'GUEST-' + doc.appointmentCode,
          reason?.trim() || "Guest Appointment",
          'guest-booking'
        );
      console.log(`✅ Updated ScheduleModel for guest appointment: ${doc.appointmentCode}`);
    } catch (scheduleError) {
      console.error(`❌ Failed to book slot in ScheduleModel for guest appointment ${doc.appointmentCode}:`, scheduleError.message);
      
      // If slot booking fails, delete the appointment and return error
      await Appointment.findByIdAndDelete(doc._id);
      
      if (scheduleError.message.includes('no longer available')) {
        return res.status(409).json({
          message: "This time slot is no longer available. Please select a different time.",
          conflictOn: ["dentist_code", "appointment_date"],
        });
      }
      
      return res.status(500).json({
        message: "Failed to book appointment slot. Please try again.",
        error: scheduleError.message
      });
    }

    // ✅ Auto-create queue entry for today's guest appointments (direct to queue)
    const isToday = "2025-10-17"; // Hardcoded to match queue system
    const appointmentDateStr = appointmentDate.toISOString().split('T')[0];
    
    if (appointmentDateStr === isToday) {
      // Import Queue model
      const Queue = require("../Model/QueueModel");
      
      // Check if queue entry already exists to prevent duplicates
      const existingQueue = await Queue.findOne({
        appointmentCode: doc.appointmentCode
      });
      
      if (!existingQueue) {
        // Get next position for this dentist
        const lastQueue = await Queue.findOne({ 
          dentistCode: doc.dentist_code,
          date: { $gte: new Date(`${isToday}T00:00:00Z`), $lte: new Date(`${isToday}T23:59:59Z`) }
        }).sort({ position: -1 }).limit(1);
        
        const nextPosition = lastQueue ? lastQueue.position + 1 : 1;
        
        // Create queue entry with guest identifier
        await Queue.create({
          appointmentCode: doc.appointmentCode,
          patientCode: 'GUEST-' + doc.appointmentCode,
          dentistCode: doc.dentist_code,
          date: doc.appointment_date,
          position: nextPosition,
          status: 'waiting'
        });
        
        // ✅ Remove appointment from appointment table since it's now in queue
        await Appointment.deleteOne({ appointmentCode: doc.appointmentCode });
        
        console.log('✅ Auto-created queue entry and removed appointment for today\'s guest appointment:', doc.appointmentCode);
      } else {
        console.log('✅ Queue entry already exists for guest appointment:', doc.appointmentCode);
        // ✅ Still remove appointment from appointment table if queue exists
        await Appointment.deleteOne({ appointmentCode: doc.appointmentCode });
      }
      
      return res.status(201).json({ 
        message: "Guest appointment booked and added to today's queue.",
        appointment: doc,
        autoQueued: true
      });
    }

    return res.status(201).json({ 
      message: "Appointment booked successfully. Awaiting receptionist confirmation.",
      appointment: doc 
    });
  } catch (err) {
    // Note: We no longer handle MongoDB duplicate key errors here
    // ScheduleModel is the single source of truth for availability checking

    return res.status(500).json({ message: err.message });
  }
};


const listAppointments = async (req, res) => {
  // List appointments for patients
  try {
    const { patient_code, dentist_code, status, from, to, guest_email, guest_phone } = req.query || {};
    
    // Build filter with OR condition for patient_code
    let filter = {};

    // For registered users - include both appointments for self AND appointments booked for others
    if (patient_code) {
      filter.$or = [
        { patient_code: String(patient_code) }, // Appointments for self
        { bookerPatientCode: String(patient_code) } // Appointments booked for someone else
      ];
    }
    
    // For guest users - filter by guest information
    if (guest_email) {
      if (!filter.$or) filter.$or = [];
      filter.$or.push({
        isGuestBooking: true,
        "guestInfo.email": String(guest_email).toLowerCase()
      });
    }
    if (guest_phone) {
      if (!filter.$or) filter.$or = [];
      filter.$or.push({
        isGuestBooking: true,
        "guestInfo.phone": String(guest_phone)
      });
    }
    
    // Common filters for both user types
    if (dentist_code) filter.dentist_code = String(dentist_code);
    if (status) filter.status = String(status);

    const fromDate = toDate(from);
    const toDateValue = toDate(to);
    if (fromDate || toDateValue) {
      filter.appointment_date = {};
      if (fromDate) filter.appointment_date.$gte = fromDate;
      if (toDateValue) filter.appointment_date.$lte = toDateValue;
    }

    // If no specific filters are provided, return empty array for security
    // (prevents listing all appointments publicly)
    if (!patient_code && !guest_email && !guest_phone && !dentist_code) {
      return res.status(200).json({ items: [], count: 0 });
    }

    const items = await Appointment.find(filter).sort({ appointment_date: -1 }).lean();
    
    // Fetch dentist information for each appointment
    const itemsWithDentistInfo = await Promise.all(
      items.map(async (appointment) => {
        if (appointment.dentist_code) {
          try {
            const dentist = await Dentist.findOne({ dentistCode: appointment.dentist_code })
              .select('dentistCode specialization')
              .populate({ path: 'userId', select: 'name' })
              .lean();
            
            if (dentist) {
              return {
                ...appointment,
                dentistName: dentist.userId?.name || 'Unknown',
                dentistSpecialization: dentist.specialization || 'General'
              };
            }
          } catch (error) {
            console.warn('Failed to fetch dentist info for:', appointment.dentist_code, error);
          }
        }
        
        return {
          ...appointment,
          dentistName: 'Unknown',
          dentistSpecialization: 'General'
        };
      })
    );
    
    return res.status(200).json({ items: itemsWithDentistInfo, count: itemsWithDentistInfo.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["patient_code", "dentist_code", "appointment_date", "reason", "status", "queue_no"];
    const patch = {};

    for (const field of allowed) {
      if (field in req.body) {
        patch[field] = field === "appointment_date" ? toDate(req.body[field]) : req.body[field];
      }
    }

    if ("appointment_date" in patch && !patch.appointment_date) {
      return res.status(400).json({ message: "appointment_date must be a valid ISO datetime" });
    }

    // Get the existing appointment to compare changes
    const existingAppointment = await Appointment.findById(id);
    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // If appointment date or dentist is being changed, validate the new slot
    if (patch.appointment_date || patch.dentist_code) {
      const newDate = patch.appointment_date || existingAppointment.appointment_date;
      const newDentistCode = patch.dentist_code || existingAppointment.dentist_code;

      // Use ScheduleModel for comprehensive schedule checking
      const { getAvailableSlots } = require("../Services/AvailabilityService");
      
      try {
        const dateStr = newDate.toISOString().slice(0, 10);
        
        // Use simplified AvailabilityService (handles ScheduleModel with fallback internally)
        const result = await getAvailableSlots(newDentistCode, dateStr, 30, id);
        
        // Check if the requested time slot is available
        const requestedTime = newDate.getTime();
        const availableSlot = result.slots.find(slot => 
          slot.start.getTime() === requestedTime && slot.status === 'bookable'
        );
        
        if (!availableSlot) {
          return res.status(409).json({
            message: "This time slot is not available. It may be booked, blocked by a clinic event, or outside working hours.",
            conflictOn: ["dentist_code", "appointment_date"],
          });
        }
        
      } catch (scheduleError) {
        console.error("Schedule validation error during update:", scheduleError);
        
        // Fallback to basic checks
        const isOnLeave = await Leave.isDentistOnLeave(newDentistCode, newDate);
        if (isOnLeave) {
          return res.status(400).json({ 
            message: "Cannot update appointment. Dentist is not available on this date." 
          });
        }

        // Check if slot conflicts with other appointments (excluding current one)
        const conflictingAppointment = await Appointment.findOne({
          _id: { $ne: id }, // Exclude current appointment
          dentist_code: newDentistCode,
          appointment_date: newDate,
          status: { $in: ["pending", "confirmed"] }
        });

        if (conflictingAppointment) {
          return res.status(409).json({
            message: "This time slot is already booked for this dentist.",
            conflictOn: ["dentist_code", "appointment_date"],
          });
        }
      }
    }

    const updated = await Appointment.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Appointment not found" });

    // Auto-update ScheduleModel if appointment date or dentist changed
    if (patch.appointment_date || patch.dentist_code) {
      try {
        // Free the old slot first
        await ScheduleService.cancelBooking(
          existingAppointment.dentist_code,
          existingAppointment.appointment_date,
          existingAppointment._id.toString(),
          req.user?.id || 'system'
        );
        
        // Book the new slot
        await ScheduleService.bookSlot(
          updated.dentist_code,
          updated.appointment_date,
          updated._id.toString(),
          updated.patient_code || updated.bookerPatientCode,
          updated.reason || "Appointment",
          req.user?.id || 'system'
        );
        
        console.log(`✅ Updated ScheduleModel for appointment update: ${updated.appointmentCode}`);
      } catch (scheduleError) {
        console.error(`⚠️ Failed to update ScheduleModel for appointment update ${updated.appointmentCode}:`, scheduleError.message);
        // Don't fail the appointment update if schedule update fails
      }
    }

    return res.status(200).json({ appointment: updated });
  } catch (err) {
    // Note: We no longer handle MongoDB duplicate key errors here
    // ScheduleModel is the single source of truth for availability checking

    return res.status(500).json({ message: err.message });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const removed = await Appointment.findByIdAndDelete(req.params.id).lean();
    if (!removed) return res.status(404).json({ message: "Appointment not found" });

    // Auto-update ScheduleModel - free the slot
    try {
      await ScheduleService.cancelBooking(
        removed.dentist_code,
        removed.appointment_date,
        removed._id.toString(),
        req.user?.id || 'system'
      );
      console.log(`✅ Freed ScheduleModel slot for deleted appointment: ${removed.appointmentCode}`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to free ScheduleModel slot for deleted appointment ${removed.appointmentCode}:`, scheduleError.message);
      // Don't fail the deletion if schedule update fails
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Convenience function for receptionists to confirm pending appointments
const confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the appointment and check if it's pending
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    if (appointment.status !== "pending") {
      return res.status(400).json({ 
        message: `Cannot confirm appointment. Current status is "${appointment.status}". Only pending appointments can be confirmed.` 
      });
    }
    
    // Update status to confirmed
    const updated = await Appointment.findByIdAndUpdate(
      id, 
      { status: "confirmed" }, 
      { new: true, runValidators: true }
    );
    
    return res.status(200).json({ 
      message: "Appointment confirmed successfully", 
      appointment: updated 
    });
  } catch (err) {
    console.error("confirmAppointment error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

const sendAppointmentOtp = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { slotIso, durationMinutes, dentistCode, doctorId, doctorName, reason } = req.body || {};
    if (!slotIso) return res.status(400).json({ message: "slotIso is required" });

    const appointmentDate = toDate(slotIso);
    if (!appointmentDate) return res.status(400).json({ message: "slotIso must be a valid ISO datetime" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const patient = await Patient.findOne({ userId }).lean();
    if (!patient || !patient.patientCode) {
      return res.status(400).json({ message: "Patient profile is incomplete. Cannot send OTP." });
    }

    const normalizedPhone = normalizePhone(user.contact_no || patient.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is missing or invalid. Update your profile with a valid number." });
    }

    const dentistInfo = await resolveDentistCode({ dentistCode, doctorId });
    const dentistCodeValue = dentistInfo.dentistCode || dentistCode || doctorId || "UNKNOWN";
    const dentistDisplayName = doctorName || dentistInfo.dentistName || dentistCodeValue;

    // ✅ CHECK SLOT AVAILABILITY BEFORE SENDING OTP (Prevent race condition)
    const existingAppointment = await Appointment.findOne({
      dentist_code: dentistCodeValue,
      appointment_date: appointmentDate,
      status: { $in: ["pending", "confirmed"] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: "This time slot is no longer available. Please select a different time.",
        conflictOn: ["dentist_code", "appointment_date"],
      });
    }

    // Check if dentist is on leave
    const isOnLeave = await Leave.isDentistOnLeave(dentistCodeValue, appointmentDate);
    if (isOnLeave) {
      return res.status(400).json({ 
        message: "Cannot book appointment. Dentist is not available on this date (on leave)." 
      });
    }

    // Check for clinic events
    const ClinicEvent = require("../Model/ClinicEventModel");
    const slotEnd = new Date(appointmentDate.getTime() + (parseInt(durationMinutes) || 30) * 60000);
    
    const clinicEvent = await ClinicEvent.findOne({
      isDeleted: false,
      isPublished: true,
      startDate: { $lte: slotEnd },
      endDate: { $gte: appointmentDate }
    });

    if (clinicEvent) {
      return res.status(400).json({
        message: `Cannot book appointment. There is a clinic event: ${clinicEvent.title}`,
      });
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    const otpRecord = await OtpToken.create({
      userId,
      context: "appointment",
      codeHash,
      expiresAt,
      data: {
        patient_code: patient.patientCode,
        dentist_code: dentistCodeValue,
        appointment_date: appointmentDate.toISOString(),
        durationMinutes: Number(durationMinutes) || 30,
        doctorId: doctorId || null,
        doctorName: dentistDisplayName,
        reason: normalizeText(reason),
      },
    });

    try {
      const smsResult = await sendSms({
        to: normalizedPhone,
        body: `${OTP_MESSAGE_PREFIX} ${otp}. It expires in ${Math.round(OTP_EXPIRY_MS / 60000)} minutes.`,
      });

      // Include OTP in response for development mode
      const responseData = {
        message: "OTP sent successfully",
        otpId: otpRecord._id,
        expiresAt: expiresAt.toISOString(),
        sentPhone: smsResult?.to || normalizedPhone,
      };

      // Always log OTP to console for debugging (including production for now)
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔐 APPOINTMENT OTP CODE:', otp);
      console.log('📱 Sent to phone:', normalizedPhone);
      console.log('👤 User:', user.name, '(', userId, ')');
      console.log('⏰ Expires at:', expiresAt.toLocaleString());
      console.log('🏥 Dentist:', dentistDisplayName);
      console.log('📅 Date:', appointmentDate.toLocaleString());
      console.log('═══════════════════════════════════════════════════════');
      
      // Only include the actual OTP in non-production environments for debugging
      if (process.env.NODE_ENV !== "production") {
        responseData.otp = otp;
      }

      return res.status(200).json(responseData);
    } catch (err) {
      await otpRecord.deleteOne();
      console.error("Failed to send OTP SMS:", err);
      const errorMessage = process.env.NODE_ENV === "production" ? "Failed to send OTP SMS. Please try again later." : `Failed to send OTP SMS: ${err.message || err}`;
      return res.status(500).json({ message: errorMessage });
    }
  } catch (err) {
    console.error("sendAppointmentOtp error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

const verifyAppointmentOtp = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { otpId, code, reason, bookingForSomeoneElse, otherPersonDetails } = req.body || {};
    if (!otpId || !code) return res.status(400).json({ message: "otpId and code are required" });

    const otpRecord = await OtpToken.findOne({ _id: otpId, userId, context: "appointment" });
    if (!otpRecord) return res.status(400).json({ message: "Invalid or expired OTP" });

    if (otpRecord.expiresAt < new Date()) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(400).json({ message: "OTP has expired" });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(429).json({ message: "Too many invalid attempts. Request a new OTP." });
    }

    const isMatch = await bcrypt.compare(String(code), otpRecord.codeHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const payload = otpRecord.data || {};
    const appointmentDate = toDate(payload.appointment_date);
    if (!appointmentDate) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(400).json({ message: "Stored appointment data is invalid" });
    }

    // Check if dentist is on leave for this date
    console.log("verifyAppointmentOtp - payload:", payload);
    console.log("verifyAppointmentOtp - dentist_code:", payload.dentist_code);
    let isOnLeave = false;
    try {
      isOnLeave = await Leave.isDentistOnLeave(payload.dentist_code, appointmentDate);
    } catch (leaveError) {
      console.error("Error checking leave status:", leaveError);
      // Continue without leave check if there's an error
      isOnLeave = false;
    }
    if (isOnLeave) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(400).json({ 
        message: "Cannot confirm appointment. Dentist is not available on this date." 
      });
    }

    // Check if slot is still available
    const existingAppointment = await Appointment.findOne({
      dentist_code: payload.dentist_code,
      appointment_date: appointmentDate,
      status: { $in: ["pending", "confirmed"] }
    });

    if (existingAppointment) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(409).json({
        message: "This time slot is no longer available. Please select a different time.",
        conflictOn: ["dentist_code", "appointment_date"],
      });
    }

    // Get patient code from authenticated user (the booker)
    const bookerPatientCode = req.user?.patientCode;
    if (!bookerPatientCode) {
      return res.status(400).json({ message: "Patient profile not found. Please complete your registration." });
    }

    const booking = {
      dentist_code: payload.dentist_code,
      appointment_date: appointmentDate,
      reason: normalizeText(reason) || payload.reason || "",
      status: "pending", // OTP verified appointments also start as pending
    };

    // Handle "booking for someone else" from request body
    if (bookingForSomeoneElse && otherPersonDetails) {
      // Validate other person's details
      if (!otherPersonDetails.name?.trim()) {
        return res.status(400).json({ message: "Other person's name is required" });
      }
      if (!otherPersonDetails.contact?.trim()) {
        return res.status(400).json({ message: "Other person's contact is required" });
      }

      booking.isBookingForSomeoneElse = true;
      booking.bookerPatientCode = bookerPatientCode;
      booking.otherPersonDetails = {
        name: otherPersonDetails.name.trim(),
        contact: otherPersonDetails.contact.trim(),
        age: otherPersonDetails.age ? parseInt(otherPersonDetails.age) : undefined,
        gender: otherPersonDetails.gender || '',
        relation: otherPersonDetails.relation?.trim() || '',
        notes: otherPersonDetails.notes?.trim() || ''
      };

      // Try to find if the other person is already a registered patient by contact
      const existingPatient = await Patient.findOne({ 
        $or: [
          { phone: otherPersonDetails.contact.trim() },
          { email: otherPersonDetails.contact.trim() }
        ]
      }).lean();

      if (existingPatient) {
        booking.appointmentForPatientCode = existingPatient.patientCode;
      }
    } else {
      // Regular booking for self
      booking.patient_code = bookerPatientCode;
    }

    try {
      const appointment = await Appointment.create(booking);
      await otpRecord.deleteOne().catch(() => {});
      
      // Auto-update ScheduleModel - book the slot
      try {
        await ScheduleService.bookSlot(
          payload.dentist_code,
          appointmentDate,
          appointment._id.toString(),
          appointment.isBookingForSomeoneElse ? (appointment.appointmentForPatientCode || appointment.bookerPatientCode) : appointment.patient_code,
          booking.reason || "Appointment",
          bookerPatientCode
        );
        console.log(`✅ Updated ScheduleModel for OTP appointment: ${appointment.appointmentCode}`);
      } catch (scheduleError) {
        console.error(`❌ Failed to book slot in ScheduleModel for OTP appointment ${appointment.appointmentCode}:`, scheduleError.message);
        
        // If slot booking fails, mark appointment as cancelled and return error
        appointment.status = 'cancelled';
        appointment.cancelledAt = new Date();
        appointment.cancelledBy = 'system';
        await appointment.save();
        
        if (scheduleError.message.includes('no longer available')) {
          return res.status(409).json({
            message: "This time slot is no longer available. Please select a different time.",
            conflictOn: ["dentist_code", "appointment_date"],
          });
        }
        
        return res.status(500).json({
          message: "Failed to confirm appointment slot. Please try again.",
          error: scheduleError.message
        });
      }
      
      // ✅ Auto-create queue entry for today's appointments (direct to queue)
      const isToday = "2025-10-17"; // Hardcoded to match queue system
      const appointmentDateStr = appointmentDate.toISOString().split('T')[0];
      
      if (appointmentDateStr === isToday) {
        // Import Queue model
        const Queue = require("../Model/QueueModel");
        
        // Check if queue entry already exists to prevent duplicates
        const existingQueue = await Queue.findOne({
          appointmentCode: appointment.appointmentCode
        });
        
        if (!existingQueue) {
          // Get next position for this dentist
          const lastQueue = await Queue.findOne({ 
            dentistCode: appointment.dentist_code,
            date: { $gte: new Date(`${isToday}T00:00:00Z`), $lte: new Date(`${isToday}T23:59:59Z`) }
          }).sort({ position: -1 }).limit(1);
          
          const nextPosition = lastQueue ? lastQueue.position + 1 : 1;
          
          // Determine patient code for queue
          const queuePatientCode = appointment.isBookingForSomeoneElse 
            ? (appointment.appointmentForPatientCode || appointment.bookerPatientCode || 'TEMP')
            : appointment.patient_code;
          
          // Create queue entry directly
          await Queue.create({
            appointmentCode: appointment.appointmentCode,
            patientCode: queuePatientCode,
            dentistCode: appointment.dentist_code,
            date: appointment.appointment_date,
            position: nextPosition,
            status: 'waiting'
          });
          
          // ✅ Remove appointment from appointment table since it's now in queue
          await Appointment.deleteOne({ appointmentCode: appointment.appointmentCode });
          
          console.log('✅ Auto-created queue entry and removed appointment for today\'s appointment:', appointment.appointmentCode);
        } else {
          console.log('✅ Queue entry already exists for appointment:', appointment.appointmentCode);
          // ✅ Still remove appointment from appointment table if queue exists
          await Appointment.deleteOne({ appointmentCode: appointment.appointmentCode });
        }
      }
      
      return res.status(201).json({ message: "Appointment booked successfully. Awaiting receptionist confirmation.", appointment });
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.dentist_code && err?.keyPattern?.appointment_date) {
        await otpRecord.deleteOne().catch(() => {});
        return res.status(409).json({
          message: "This dentist is already booked for that exact time.",
          conflictOn: ["dentist_code", "appointment_date"],
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("verifyAppointmentOtp error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

module.exports = {
  bookAppointment,
  bookGuestAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
  confirmAppointment,
  sendAppointmentOtp,
  verifyAppointmentOtp,
  getAvailableSlots,
};


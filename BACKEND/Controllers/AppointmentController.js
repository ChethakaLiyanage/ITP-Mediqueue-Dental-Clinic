const Appointment = require("../Model/AppointmentModel");
const DentistModel = require("../Model/DentistModel");
const PatientModel = require("../Model/PatientModel");
const ScheduleModel = require("../Model/ScheduleModel");
const { getDayNameUTC } = require("../utils/time");
const crypto = require('crypto');

// In-memory OTP storage (in production, use Redis or database)
const otpStorage = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Store OTP with expiration (5 minutes)
const storeOTP = (patientCode, otp) => {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStorage.set(patientCode, { otp, expiresAt });
};

// Verify OTP helper function
const verifyOTPHelper = (patientCode, inputOTP) => {
  const stored = otpStorage.get(patientCode);
  if (!stored) {
    return { valid: false, message: "OTP not found or expired" };
  }
  
  if (Date.now() > stored.expiresAt) {
    otpStorage.delete(patientCode);
    return { valid: false, message: "OTP has expired" };
  }
  
  if (stored.otp !== inputOTP) {
    return { valid: false, message: "Invalid OTP" };
  }
  
  // OTP is valid, remove it
  otpStorage.delete(patientCode);
  return { valid: true, message: "OTP verified successfully" };
};

// Helper function to check if a specific slot is available in ScheduleModel
const isSlotAvailable = async (dentistCode, appointmentDate) => {
  try {
    console.log(`🔍 Checking slot availability for ${dentistCode} at ${appointmentDate.toISOString()}`);
    
    // Get dentist info
    const dentist = await DentistModel.findOne({ dentistCode })
      .populate('userId', 'name isActive');
    if (!dentist) {
      return { available: false, reason: "Dentist not found" };
    }
    
    if (!dentist.userId?.isActive) {
      return { available: false, reason: "Dentist not active" };
    }
    
    // Get day name and working hours
    const dateStr = appointmentDate.toISOString().slice(0, 10); // Get YYYY-MM-DD format
    const dayName = getDayNameUTC(dateStr);
    const workingHours = dentist.availability_schedule?.[dayName];
    
    console.log(`🔍 Day: ${dayName}, Working hours: ${workingHours}`);
    
    // Check if dentist is available on this day
    if (!workingHours || workingHours === 'Not Available' || workingHours === '-') {
      return { available: false, reason: "Dentist not available on this day" };
    }
    
    // Parse working hours
    const [startTime, endTime] = workingHours.split('-');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Check if appointment time is within working hours (using LOCAL time)
    const appointmentHour = appointmentDate.getHours();
    const appointmentMin = appointmentDate.getMinutes();
    const appointmentMinutes = appointmentHour * 60 + appointmentMin;
    const workingStartMinutes = startHour * 60 + startMinute;
    const workingEndMinutes = endHour * 60 + endMinute;
    
    console.log(`🔍 Appointment: ${appointmentHour}:${appointmentMin} (${appointmentMinutes} min)`);
    console.log(`🔍 Working: ${startHour}:${startMinute} - ${endHour}:${endMinute} (${workingStartMinutes}-${workingEndMinutes} min)`);
    
    if (appointmentMinutes < workingStartMinutes || appointmentMinutes >= workingEndMinutes) {
      return { available: false, reason: "Appointment time is outside working hours" };
    }
    
    // Check if slot is blocked in ScheduleModel (using local time)
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Find blocked slots for this time
    const blockedSlots = await ScheduleModel.find({
      dentistCode,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['booked', 'blocked_leave', 'blocked_event', 'blocked_maintenance'] }
    });
    
    console.log(`🔍 Found ${blockedSlots.length} blocked slots`);
    
    // Check if the requested time slot is blocked
    for (const blockedSlot of blockedSlots) {
      const [blockedStart, blockedEnd] = blockedSlot.timeSlot.split('-');
      const [blockedStartHour, blockedStartMin] = blockedStart.split(':').map(Number);
      const [blockedEndHour, blockedEndMin] = blockedEnd.split(':').map(Number);
      
      const blockedStartMinutes = blockedStartHour * 60 + blockedStartMin;
      const blockedEndMinutes = blockedEndHour * 60 + blockedEndMin;
      
      if (appointmentMinutes >= blockedStartMinutes && appointmentMinutes < blockedEndMinutes) {
        console.log(`🚫 Slot is blocked: ${blockedSlot.timeSlot} (${blockedSlot.status})`);
        return { available: false, reason: `Time slot is ${blockedSlot.status}` };
      }
    }
    
    console.log(`✅ Slot is available`);
    return { available: true };
    
  } catch (error) {
    console.error("❌ ERROR in isSlotAvailable:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error message:", error.message);
    return { available: false, reason: "Error checking availability" };
  }
};

// GET /appointments - Get all appointments for a patient or dentist
const getAppointments = async (req, res) => {
  try {
    const { patientCode, dentistCode, status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Build query based on user role
    if (req.user.role === 'Patient' && req.user.patientCode) {
      query.patientCode = req.user.patientCode;
    } else if (req.user.role === 'Dentist' && req.user.dentistCode) {
      query.dentistCode = req.user.dentistCode;
    } else if (patientCode) {
      query.patientCode = patientCode;
    } else if (dentistCode) {
      query.dentistCode = dentistCode;
    }

    // Add filters
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message
    });
  }
};

// GET /appointments/available-slots - Get available time slots for a dentist
const getAvailableSlots = async (req, res) => {
  try {
    const { dentistCode, date, duration = 30 } = req.query;
    
    if (!dentistCode || !date) {
      return res.status(400).json({
        success: false,
        message: "Dentist code and date are required"
      });
    }

    // Check if dentist exists and is active
    const dentist = await DentistModel.findOne({ dentistCode }).populate('userId');
    if (!dentist) {
      return res.status(404).json({
        success: false,
        message: "Dentist not found"
      });
    }

    if (!dentist.userId?.isActive) {
      return res.status(404).json({
        success: false,
        message: "Dentist is not active"
      });
    }

    const targetDate = new Date(date);
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Get dentist's working hours from availability_schedule
    const workingHours = dentist.availability_schedule?.[dayName];
    
    if (!workingHours || workingHours === 'Not Available' || workingHours === '-') {
      return res.status(200).json({
        success: true,
        slots: [],
        message: "Dentist not available on this day"
      });
    }

    // Create date range for ScheduleModel query (using local time)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // SIMPLE LOGIC: Check dentist availability + filter schedule table
    console.log(`🔍 Checking dentist availability for ${dentistCode} on ${date}`);
    
    // 1. Check if dentist is available on this day (from DentistModel)
    if (!workingHours || workingHours === 'Not Available' || workingHours === '-') {
      return res.status(200).json({
        success: true,
        slots: [],
        message: "Dentist not available on this day"
      });
    }

    // 2. Generate time slots based on working hours
    const slotDuration = parseInt(duration);
    const [startTime, endTime] = workingHours.split('-');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Generate all possible slots for the working period
    const allPossibleSlots = [];
    let currentHour = startHour;
    let currentMin = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMinute)) {
      const slotStart = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      currentMin += slotDuration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
      
      const slotEnd = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      // Only add slot if it doesn't go beyond working hours
      if (currentHour < endHour || (currentHour === endHour && currentMin <= endMinute)) {
        allPossibleSlots.push({
          timeSlot: `${slotStart}-${slotEnd}`,
          startTime: slotStart,
          endTime: slotEnd,
          startMinutes: currentHour * 60 + currentMin - slotDuration,
          endMinutes: currentHour * 60 + currentMin
        });
      }
    }

    console.log(`🔍 Generated ${allPossibleSlots.length} possible slots for working hours ${workingHours}`);

    // 3. Check ScheduleModel for blocked/booked slots
    const blockedSlots = await ScheduleModel.find({
      dentistCode: dentistCode,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['booked', 'blocked_leave', 'blocked_event', 'blocked_maintenance'] }
    });

    console.log(`🔍 Found ${blockedSlots.length} blocked slots in ScheduleModel`);

    // 3.5. Check AppointmentModel for existing appointments (queue table)
    const existingAppointments = await Appointment.find({
      dentistCode: dentistCode,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' } // Exclude cancelled appointments
    });

    console.log(`🔍 Found ${existingAppointments.length} existing appointments in AppointmentModel`);

    // 4. Filter out blocked slots, existing appointments, AND past time slots
    const availableSlots = [];
    const currentTime = new Date();
    
    for (const slot of allPossibleSlots) {
      // Create slot time for comparison (using LOCAL time, not UTC)
        const slotTime = new Date(targetDate);
      slotTime.setHours(parseInt(slot.startTime.split(':')[0]), parseInt(slot.startTime.split(':')[1]), 0, 0);
      
      // Check if this slot is in the past
      const isPastSlot = slotTime <= currentTime;
      
      // Check if this slot is blocked in ScheduleModel
      const isBlocked = blockedSlots.some(blockedSlot => {
        return blockedSlot.timeSlot === slot.timeSlot;
      });

      // Check if this slot has an existing appointment (using local time)
      const hasExistingAppointment = existingAppointments.some(appointment => {
        const appointmentHour = appointment.appointmentDate.getHours();
        const appointmentMin = appointment.appointmentDate.getMinutes();
        const slotStartHour = parseInt(slot.startTime.split(':')[0]);
        const slotStartMin = parseInt(slot.startTime.split(':')[1]);
        
        // Check if appointment time matches slot start time
        return appointmentHour === slotStartHour && appointmentMin === slotStartMin;
      });

      if (!isPastSlot && !isBlocked && !hasExistingAppointment) {
        availableSlots.push({
            time: slotTime.toISOString(),
            available: true,
            timeSlot: slot.timeSlot,
          duration: slotDuration,
          displayTime: slot.startTime
          });
        } else {
        if (isPastSlot) {
          console.log(`🚫 Slot ${slot.timeSlot} is in the past, skipping`);
        }
        if (isBlocked) {
          console.log(`🚫 Slot ${slot.timeSlot} is blocked in ScheduleModel, skipping`);
        }
        if (hasExistingAppointment) {
          console.log(`🚫 Slot ${slot.timeSlot} has existing appointment, skipping`);
        }
      }
    }

    console.log(`🔍 Found ${availableSlots.length} available slots after filtering blocked slots`);

    console.log(`✅ Returning ${availableSlots.length} available slots for ${dentistCode} on ${date}`);
    console.log(`✅ Slots: ${availableSlots.map(s => s.displayTime).join(', ')}`);

    res.status(200).json({
      success: true,
      slots: availableSlots,
      dentist: {
        dentistCode: dentist.dentistCode,
        name: dentist.userId?.name || 'Unknown',
        specialization: dentist.specialization
      },
      date: date,
      workingHours: workingHours
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available slots",
      error: error.message
    });
  }
};

    // POST /appointments - Create a new appointment
    const createAppointment = async (req, res) => {
      try {
        const { 
          dentistCode, 
          appointmentDate, 
          duration = 30, 
          reason, 
          notes,
          isBookingForSomeoneElse = false,
          actualPatientName,
          actualPatientEmail,
          actualPatientPhone,
          actualPatientAge,
          relationshipToPatient = 'Self'
        } = req.body;
    
    // Validate required fields
    if (!dentistCode || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "Dentist code and appointment date are required"
      });
    }

    // Handle patient code - support both authenticated and unregistered users
    let patientCode;
    
    if (req.user) {
      // Authenticated user - check if patientCode is provided in request body first
      patientCode = req.body.patientCode || req.user.patientCode;
      
      // If user doesn't have a patientCode, check if they have a patient record
      if (!patientCode) {
        const PatientModel = require("../Model/PatientModel");
        const patient = await PatientModel.findOne({ userId: req.user.id });
        
        if (patient) {
          patientCode = patient.patientCode;
          // Update req.user for future requests
          req.user.patientCode = patientCode;
        } else {
          return res.status(400).json({
            success: false,
            message: "Please send OTP first to create your patient record."
          });
        }
      }
    } else {
      // Unregistered user - create a temporary patient code
      patientCode = `GUEST-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      // For unregistered users, we need to save their contact info for searching
      if (!actualPatientName || !actualPatientEmail || !actualPatientPhone) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and phone number are required for guest bookings"
        });
      }
    }

    const appointmentDateTime = new Date(appointmentDate);
    
    // Check if the specific slot is available in ScheduleModel
    const availability = await isSlotAvailable(dentistCode, appointmentDateTime);
    if (!availability.available) {
      return res.status(409).json({
        success: false,
        message: availability.reason
      });
    }

        // Check if appointment is for today - if so, auto-confirm
        const today = new Date();
        const appointmentDateObj = new Date(appointmentDateTime);
        const isToday = appointmentDateObj.toDateString() === today.toDateString();
        
        if (isToday) {
          console.log(`✅ Today's appointment - going directly to queue: ${appointmentDateTime.toISOString()}`);
        } else {
          console.log(`📅 Future appointment - storing in AppointmentModel: ${appointmentDateTime.toISOString()}`);
        }
        
        let appointment = null;
        let appointmentCode = null;
        
        if (isToday) {
          // For today's appointments, skip AppointmentModel and go directly to QueueModel
          console.log(`🚀 Today's appointment - skipping AppointmentModel, going to QueueModel`);
          
          // Generate appointment code manually for today's appointments
          const Counter = require("../Model/Counter");
          const { pad } = require("../utils/seq");
          const counter = await Counter.findOneAndUpdate(
            { scope: 'appointmentCode' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
          );
          appointmentCode = `AP-${pad(counter.seq, 4)}`;
          
        } else {
          // For future appointments, create in AppointmentModel as usual
          const appointmentData = {
            patientCode,
            dentistCode,
            appointmentDate: appointmentDateTime,
            duration: parseInt(duration),
            reason: reason || '',
            notes: notes || '',
            createdBy: patientCode,
            isBookingForSomeoneElse,
            relationshipToPatient,
            status: 'pending'
          };

          // Add actual patient details if booking for someone else OR if unregistered user
          if (isBookingForSomeoneElse || !req.user) {
            appointmentData.actualPatientName = actualPatientName;
            appointmentData.actualPatientEmail = actualPatientEmail;
            appointmentData.actualPatientPhone = actualPatientPhone;
            appointmentData.actualPatientAge = actualPatientAge ? parseInt(actualPatientAge) : null;
          }

          appointment = new Appointment(appointmentData);
          await appointment.save();
          appointmentCode = appointment.appointmentCode;
          console.log(`✅ Future appointment saved to AppointmentModel: ${appointmentCode}`);
        }

    // Also save to ScheduleModel to block the slot
    try {
      // Create a new slot entry to mark this time as booked
      const slotData = {
        dentistCode: dentistCode,
        date: appointmentDateTime,
        timeSlot: `${appointmentDateTime.getUTCHours().toString().padStart(2, '0')}:${appointmentDateTime.getUTCMinutes().toString().padStart(2, '0')}-${(appointmentDateTime.getUTCHours() + Math.floor(duration/60)).toString().padStart(2, '0')}:${((appointmentDateTime.getUTCMinutes() + duration%60) % 60).toString().padStart(2, '0')}`,
        status: 'booked',
        isAvailable: false,
        appointmentId: appointmentCode,
        patientCode: patientCode,
        reason: reason || 'Appointment',
        lastModifiedBy: patientCode
      };
      
      const slot = new ScheduleModel(slotData);
        await slot.save();
      console.log(`✅ Appointment slot saved to ScheduleModel: ${appointmentCode}`);
    } catch (scheduleError) {
      console.warn("Could not save to schedule model:", scheduleError.message);
    }

    // For today's appointments, also add to QueueModel
    if (isToday) {
      try {
        const Queue = require("../Model/QueueModel");
        
        // Get the highest position number for today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const lastQueue = await Queue.findOne({ 
          date: { $gte: todayStart, $lte: todayEnd },
          dentistCode: dentistCode
        }).sort({ position: -1 }).limit(1);
        
        const nextPosition = lastQueue ? lastQueue.position + 1 : 1;

        const queueData = {
          appointmentCode: appointmentCode,
          patientCode: patientCode,
          dentistCode: dentistCode,
          date: appointmentDateTime,
          position: nextPosition,
          status: 'waiting',
          reason: reason || 'General consultation',
          duration: parseInt(duration),
          notes: notes || '',
          
          // For someone else booking details
          isBookingForSomeoneElse: isBookingForSomeoneElse || false,
          actualPatientName: actualPatientName || null,
          actualPatientEmail: actualPatientEmail || null,
          actualPatientPhone: actualPatientPhone || null,
          actualPatientAge: actualPatientAge ? parseInt(actualPatientAge) : null,
          relationshipToPatient: relationshipToPatient || null
        };

        const queue = new Queue(queueData);
        await queue.save();
        console.log(`✅ Today's appointment added to QueueModel: ${appointmentCode} (position: ${nextPosition})`);
      } catch (queueError) {
        console.warn("Could not save to queue model:", queueError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: isToday ? "Today's appointment added to queue successfully" : "Appointment created successfully",
      appointment: appointment || {
        appointmentCode: appointmentCode,
        patientCode: patientCode,
        dentistCode: dentistCode,
        appointmentDate: appointmentDateTime,
        status: 'confirmed',
        isTodayAppointment: true
      }
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message
    });
  }
};

// PUT /appointments/:id - Update an appointment
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Check permissions
    const canUpdate = req.user.role === 'Admin' || 
                     (req.user.role === 'Patient' && appointment.patientCode === req.user.patientCode) ||
                     (req.user.role === 'Dentist' && appointment.dentistCode === req.user.dentistCode);
    
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this appointment"
      });
    }

    // If updating appointment date, check slot availability
    if (updates.appointmentDate) {
      const newDate = new Date(updates.appointmentDate);
      const availability = await isSlotAvailable(appointment.dentistCode, newDate);
      if (!availability.available) {
        return res.status(409).json({
          success: false,
          message: availability.reason
        });
      }
    }

    // Update appointment
    Object.assign(appointment, updates);
    appointment.updatedBy = req.user.patientCode || req.user.dentistCode || req.user.id;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      appointment
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
      error: error.message
    });
  }
};

// DELETE /appointments/:id - Cancel an appointment
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Check permissions
    const canCancel = req.user.role === 'Admin' || 
                     (req.user.role === 'Patient' && appointment.patientCode === req.user.patientCode) ||
                     (req.user.role === 'Dentist' && appointment.dentistCode === req.user.dentistCode);
    
    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this appointment"
      });
    }

    // Check if appointment can be cancelled
    if (!appointment.canBeCancelled()) {
      const appointmentDate = new Date(appointment.appointmentDate);
      const today = new Date();
      const isToday = appointmentDate.toDateString() === today.toDateString();
      
      if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
          message: "Only pending appointments can be cancelled"
        });
      }
      
      if (isToday) {
        return res.status(400).json({
          success: false,
          message: "Today's appointments cannot be cancelled (they are auto-confirmed)"
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Appointment cannot be cancelled"
      });
    }

    // Update appointment status
    appointment.status = 'cancelled';
    appointment.updatedBy = req.user.patientCode || req.user.dentistCode || req.user.id;
    await appointment.save();

    // Update schedule model if it exists
    try {
      const scheduleSlot = await ScheduleModel.findOne({
        dentistCode: appointment.dentistCode,
        appointmentId: appointment.appointmentCode
      });
      
      if (scheduleSlot) {
        scheduleSlot.status = 'available';
        scheduleSlot.appointmentId = null;
        scheduleSlot.patientCode = null;
        scheduleSlot.reason = null;
        await scheduleSlot.save();
      }
    } catch (scheduleError) {
      console.warn("Could not update schedule model:", scheduleError.message);
    }

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
      error: error.message
    });
  }
};

// GET /appointments/:id - Get a specific appointment
const getAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Check permissions
    const canView = req.user.role === 'Admin' || 
                   (req.user.role === 'Patient' && appointment.patientCode === req.user.patientCode) ||
                   (req.user.role === 'Dentist' && appointment.dentistCode === req.user.dentistCode);
    
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this appointment"
      });
    }

    res.status(200).json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment",
      error: error.message
    });
  }
};

// POST /appointments/send-otp - Send OTP for appointment booking
const sendOTP = async (req, res) => {
  try {
    console.log('🔍 sendOTP called for user:', req.user);
    console.log('🔍 User ID:', req.user.id);
    console.log('🔍 User role:', req.user.role);
    console.log('🔍 Patient code:', req.user.patientCode);
    
    // Check if user has Patient role
    if (req.user.role !== 'Patient') {
      console.log('❌ User does not have Patient role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: "Only patients can book appointments"
      });
    }
    
    let patientCode = req.user.patientCode;
    
    // If user doesn't have a patientCode, check if they have a patient record
    if (!patientCode) {
      const PatientModel = require("../Model/PatientModel");
      const patient = await PatientModel.findOne({ userId: req.user.id });
      
      if (patient) {
        patientCode = patient.patientCode;
        // Update req.user for future requests
        req.user.patientCode = patientCode;
      } else {
        try {
          // Create a temporary patient record for booking purposes
          const Counter = require("../Model/Counter");
          const { pad } = require("../utils/seq");
          
          console.log('🔍 Creating patient record for user:', req.user.id);
          
          // Get next patient code
          const counter = await Counter.findOneAndUpdate(
            { scope: "patientCode" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
          );
          patientCode = `P-${pad(counter.seq, 4)}`;
          
          console.log('🔍 Generated patient code:', patientCode);
          
          // Create patient record
          const newPatient = await PatientModel.create({
            userId: req.user.id,
            patientCode: patientCode,
            // Set default values for required fields
            nic: `TEMP-${req.user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique temporary NIC
            dob: new Date('1990-01-01'), // Default DOB
            gender: 'Other', // Default gender
            address: 'Not specified',
            allergies: 'None known'
          });
          
          console.log('🔍 Created patient record:', newPatient);
          
          // Update req.user for future requests
          req.user.patientCode = patientCode;
          console.log(`Created temporary patient record: ${patientCode} for user: ${req.user.id}`);
        } catch (createError) {
          console.error('❌ Error creating patient record:', createError);
          return res.status(500).json({
            success: false,
            message: "Failed to create patient record",
            error: createError.message
          });
        }
      }
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(patientCode, otp);

    // In a real application, you would send this OTP via SMS or email
    // For now, we'll return it in the response (for testing purposes)
    console.log(`OTP for patient ${patientCode}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      // Always return OTP for testing purposes
      otp: otp
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message
    });
  }
};

// POST /appointments/verify-otp - Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    let patientCode = req.user.patientCode;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required"
      });
    }

    // If user doesn't have a patientCode, check if they have a patient record
    if (!patientCode) {
      const PatientModel = require("../Model/PatientModel");
      const patient = await PatientModel.findOne({ userId: req.user.id });
      
      if (patient) {
        patientCode = patient.patientCode;
        // Update req.user for future requests
        req.user.patientCode = patientCode;
      } else {
        return res.status(400).json({
          success: false,
          message: "Please send OTP first to create your patient record."
        });
      }
    }

    const verification = verifyOTPHelper(patientCode, otp);
    
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    res.status(200).json({
      success: true,
      message: verification.message
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message
    });
  }
};

    // GET /appointments/check - Check appointments for unregistered users
    const checkAppointments = async (req, res) => {
      try {
        const { method, value } = req.query;
        
        if (!method || !value) {
          return res.status(400).json({
            success: false,
            message: "Search method and value are required"
          });
        }

        let query = {};
        
        if (method === 'email') {
          // Search by actual patient email (for bookings for someone else)
          query = {
            $or: [
              { actualPatientEmail: { $regex: value, $options: 'i' } },
              // Also search in patient records if they exist
              { 'patient.email': { $regex: value, $options: 'i' } }
            ]
          };
        } else if (method === 'phone') {
          // Search by actual patient phone (for bookings for someone else)
          query = {
            $or: [
              { actualPatientPhone: { $regex: value, $options: 'i' } },
              // Also search in patient records if they exist
              { 'patient.phone': { $regex: value, $options: 'i' } }
            ]
          };
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid search method. Use 'email' or 'phone'"
          });
        }

        // Find appointments matching the search criteria
        const appointments = await Appointment.find(query)
          .populate('dentistCode', 'userId specialization')
          .populate('dentistCode.userId', 'name')
          .sort({ appointmentDate: -1 })
          .limit(10); // Limit to 10 most recent appointments

        res.status(200).json({
          success: true,
          appointments: appointments,
          count: appointments.length
        });
      } catch (error) {
        console.error("Error checking appointments:", error);
        res.status(500).json({
          success: false,
          message: "Failed to check appointments",
          error: error.message
        });
      }
    };


    // POST /appointments/:id/request-change - Request change for confirmed appointment
    const requestAppointmentChange = async (req, res) => {
      try {
        const { id } = req.params;
        const { requestedChanges, reason, preferredDate, preferredTime } = req.body;
        
        const appointment = await Appointment.findById(id);
        if (!appointment) {
          return res.status(404).json({
            success: false,
            message: "Appointment not found"
          });
        }
        
        // Check if user can request changes
        if (appointment.status !== 'confirmed') {
          return res.status(400).json({
            success: false,
            message: "Only confirmed appointments can have change requests"
          });
        }
        
        // Check if appointment is not too close (less than 2 hours)
        const appointmentDate = new Date(appointment.appointmentDate);
        const now = new Date();
        const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);
        
        if (hoursUntilAppointment < 2) {
          return res.status(400).json({
            success: false,
            message: "Cannot request changes less than 2 hours before appointment"
          });
        }
        
        // Create change request
        const changeRequest = {
          requestedBy: req.user.id,
          requestedAt: new Date(),
          requestedChanges,
          reason,
          preferredDate,
          preferredTime,
          status: 'pending'
        };
        
        // Add change request to appointment
        if (!appointment.changeRequests) {
          appointment.changeRequests = [];
        }
        appointment.changeRequests.push(changeRequest);
        
        await appointment.save();
        
        res.status(200).json({
          success: true,
          message: "Change request submitted successfully",
          changeRequest
        });
        
      } catch (error) {
        console.error('Error requesting appointment change:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to request appointment change',
          error: error.message
        });
      }
    };

    module.exports = {
      getAppointments,
      getAvailableSlots,
      createAppointment,
      updateAppointment,
      cancelAppointment,
      getAppointment,
      sendOTP,
      verifyOTP,
      checkAppointments,
      requestAppointmentChange
    };

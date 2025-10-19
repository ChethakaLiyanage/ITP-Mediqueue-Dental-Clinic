const Appointment = require("../Model/AppointmentModel");
const DentistModel = require("../Model/DentistModel");
const PatientModel = require("../Model/PatientModel");
const ScheduleModel = require("../Model/ScheduleModel");
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
    // Use UTC time to match the slot times
    const appointmentHour = appointmentDate.getUTCHours();
    const appointmentMin = appointmentDate.getUTCMinutes();
    
    const dateStr = appointmentDate.toISOString().slice(0, 10);
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
    
    // Find the slot that contains this appointment time
    const slots = await ScheduleModel.find({
      dentistCode,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'available',
      isAvailable: true
    });
    
    for (const slot of slots) {
      const [startTime, endTime] = slot.timeSlot.split('-');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const slotStartMinutes = startHour * 60 + startMin;
      const slotEndMinutes = endHour * 60 + endMin;
      const appointmentMinutes = appointmentHour * 60 + appointmentMin;
      
      if (appointmentMinutes >= slotStartMinutes && appointmentMinutes < slotEndMinutes) {
        return { available: true, slot: slot };
      }
    }
    
    return { available: false, reason: "Time slot not available" };
  } catch (error) {
    console.error("Error checking slot availability:", error);
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

    // Parse working hours (format: "09:00-17:00")
    const [startTime, endTime] = workingHours.split('-');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Create date range for ScheduleModel query
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Query ScheduleModel for available slots ONLY
    // ScheduleModel already handles leaves, events, and appointments via status field
    const availableSlots = await ScheduleModel.find({
      dentistCode: dentistCode,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'available',
      isAvailable: true
    }).sort({ timeSlot: 1 });

    console.log(`🔍 Found ${availableSlots.length} available slots in ScheduleModel for ${dentistCode} on ${date}`);
    console.log(`🔍 Working hours: ${workingHours}`);

    // Get existing appointments for this dentist on this date to avoid double booking
    const existingAppointments = await Appointment.find({
      dentistCode: dentistCode,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] }
    });

    console.log(`🔍 Found ${existingAppointments.length} existing appointments for ${dentistCode} on ${date}`);

    // Filter slots based on dentist's working hours and duration
    const slotDuration = parseInt(duration);
    const filteredSlots = [];

    for (const slot of availableSlots) {
      const [slotStart, slotEnd] = slot.timeSlot.split('-');
      const [slotStartHour, slotStartMin] = slotStart.split(':').map(Number);
      const [slotEndHour, slotEndMin] = slotEnd.split(':').map(Number);

      // Check if slot is within working hours
      const slotStartMinutes = slotStartHour * 60 + slotStartMin;
      const slotEndMinutes = slotEndHour * 60 + slotEndMin;
      const workingStartMinutes = startHour * 60 + startMinute;
      const workingEndMinutes = endHour * 60 + endMinute;

      // Check if slot fits within working hours and duration
      if (slotStartMinutes >= workingStartMinutes && 
          slotEndMinutes <= workingEndMinutes &&
          (slotEndMinutes - slotStartMinutes) >= slotDuration) {
        
        // Create slot time for the response (using UTC to avoid timezone issues)
        const slotTime = new Date(targetDate);
        slotTime.setUTCHours(slotStartHour, slotStartMin, 0, 0);

        // Check if this slot is already booked by checking existing appointments
        const isSlotBooked = existingAppointments.some(appointment => {
          const appointmentTime = new Date(appointment.appointmentDate);
          // Convert appointment time to local time for comparison
          const appointmentHour = appointmentTime.getHours();
          const appointmentMinute = appointmentTime.getMinutes();
          const appointmentStartMinutes = appointmentHour * 60 + appointmentMinute;
          
          // Check if appointment time overlaps with this slot
          const hasConflict = appointmentStartMinutes >= slotStartMinutes && 
                             appointmentStartMinutes < slotEndMinutes;
          
          if (hasConflict) {
            console.log(`🚫 CONFLICT: Slot ${slot.timeSlot} conflicts with appointment ${appointment.appointmentCode} at ${appointmentTime.toISOString()}`);
            console.log(`   Appointment: ${appointmentStartMinutes} minutes (${appointmentHour}:${appointmentMinute})`);
            console.log(`   Slot: ${slotStartMinutes}-${slotEndMinutes} minutes (${slotStart}-${slotEnd})`);
          }
          
          return hasConflict;
        });

        // Only add slot if it's not already booked
        if (!isSlotBooked) {
          filteredSlots.push({
            time: slotTime.toISOString(),
            available: true,
            timeSlot: slot.timeSlot,
            duration: slot.slotDuration,
            displayTime: slotStart
          });
        } else {
          console.log(`🚫 Slot ${slot.timeSlot} is already booked, skipping`);
        }
      }
    }

    console.log(`✅ Returning ${filteredSlots.length} filtered slots for ${dentistCode} on ${date}`);
    console.log(`✅ Slots: ${filteredSlots.map(s => s.displayTime).join(', ')}`);

    res.status(200).json({
      success: true,
      slots: filteredSlots,
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
      // Authenticated user
      patientCode = req.user.patientCode;
      
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

        // Create appointment
        const appointmentData = {
          patientCode,
          dentistCode,
          appointmentDate: appointmentDateTime,
          duration: parseInt(duration),
          reason: reason || '',
          notes: notes || '',
          createdBy: patientCode,
          isBookingForSomeoneElse,
          relationshipToPatient
        };

        // Add actual patient details if booking for someone else OR if unregistered user
        if (isBookingForSomeoneElse || !req.user) {
          appointmentData.actualPatientName = actualPatientName;
          appointmentData.actualPatientEmail = actualPatientEmail;
          appointmentData.actualPatientPhone = actualPatientPhone;
          appointmentData.actualPatientAge = actualPatientAge ? parseInt(actualPatientAge) : null;
        }

        const appointment = new Appointment(appointmentData);

    await appointment.save();
    console.log(`✅ Appointment saved to AppointmentModel: ${appointment.appointmentCode}`);

    // Also save to ScheduleModel
    try {
      if (availability.slot) {
        const slot = availability.slot;
        slot.status = 'booked';
        slot.isAvailable = false;
        slot.appointmentId = appointment.appointmentCode;
        slot.patientCode = patientCode;
        slot.reason = reason || 'Appointment';
        slot.lastModifiedBy = patientCode;
        await slot.save();
        console.log(`✅ Appointment also saved to ScheduleModel: ${appointment.appointmentCode}`);
      }
    } catch (scheduleError) {
      console.warn("Could not update schedule model:", scheduleError.message);
    }

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      appointment
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
      return res.status(400).json({
        success: false,
        message: "Appointment cannot be cancelled (less than 24 hours notice required)"
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

    module.exports = {
      getAppointments,
      getAvailableSlots,
      createAppointment,
      updateAppointment,
      cancelAppointment,
      getAppointment,
      sendOTP,
      verifyOTP,
      checkAppointments
    };

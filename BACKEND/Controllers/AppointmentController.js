const Appointment = require("../Model/AppointmentModel");
const DentistModel = require("../Model/DentistModel");
const PatientModel = require("../Model/PatientModel");
const ScheduleModel = require("../Model/ScheduleModel");

// Helper function to check if dentist is available
const isDentistAvailable = async (dentistCode, appointmentDate, duration = 30) => {
  try {
    // Check if dentist exists and is active
    const dentist = await DentistModel.findOne({ dentistCode, isActive: true });
    if (!dentist) {
      return { available: false, reason: "Dentist not found or inactive" };
    }

    // Check if dentist is on leave
    const Leave = require("../Model/LeaveModel");
    const isOnLeave = await Leave.isDentistOnLeave(dentistCode, appointmentDate);
    if (isOnLeave) {
      return { available: false, reason: "Dentist is on leave" };
    }

    // Check for conflicting appointments
    const conflictingAppointment = await Appointment.findOne({
      dentistCode,
      appointmentDate,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflictingAppointment) {
      return { available: false, reason: "Time slot already booked" };
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking dentist availability:", error);
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

    // Check if dentist exists
    const dentist = await DentistModel.findOne({ dentistCode, isActive: true });
    if (!dentist) {
      return res.status(404).json({
        success: false,
        message: "Dentist not found"
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get dentist's working hours from availability schedule
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
    const workingHours = dentist.availability_schedule?.[dayName];
    
    if (!workingHours) {
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

    // Generate time slots
    const slots = [];
    const slotDuration = parseInt(duration);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        if (hour === endHour && minute >= endMinute) break;
        
        const slotTime = new Date(targetDate);
        slotTime.setHours(hour, minute, 0, 0);
        
        // Check if this slot is available
        const isAvailable = await isDentistAvailable(dentistCode, slotTime, slotDuration);
        
        slots.push({
          time: slotTime.toISOString(),
          available: isAvailable.available,
          reason: isAvailable.reason || null
        });
      }
    }

    res.status(200).json({
      success: true,
      slots: slots.filter(slot => slot.available),
      dentist: {
        dentistCode: dentist.dentistCode,
        name: dentist.userId?.name || 'Unknown',
        specialization: dentist.specialization
      },
      date: date
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
    const { dentistCode, appointmentDate, duration = 30, reason, notes } = req.body;
    
    // Validate required fields
    if (!dentistCode || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "Dentist code and appointment date are required"
      });
    }

    // Get patient code from authenticated user
    const patientCode = req.user.patientCode;
    if (!patientCode) {
      return res.status(400).json({
        success: false,
        message: "Patient code not found. Please complete your registration."
      });
    }

    const appointmentDateTime = new Date(appointmentDate);
    
    // Check if dentist is available
    const availability = await isDentistAvailable(dentistCode, appointmentDateTime, duration);
    if (!availability.available) {
      return res.status(409).json({
        success: false,
        message: availability.reason
      });
    }

    // Create appointment
    const appointment = new Appointment({
      patientCode,
      dentistCode,
      appointmentDate: appointmentDateTime,
      duration: parseInt(duration),
      reason: reason || '',
      notes: notes || '',
      createdBy: patientCode
    });

    await appointment.save();

    // Update schedule model if it exists
    try {
      const scheduleSlot = await ScheduleModel.findOne({
        dentistCode,
        date: appointmentDateTime,
        start: appointmentDateTime
      });
      
      if (scheduleSlot) {
        scheduleSlot.status = 'booked';
        scheduleSlot.appointmentId = appointment.appointmentCode;
        scheduleSlot.patientCode = patientCode;
        scheduleSlot.reason = reason || 'Appointment';
        await scheduleSlot.save();
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

    // If updating appointment date, check availability
    if (updates.appointmentDate) {
      const newDate = new Date(updates.appointmentDate);
      const availability = await isDentistAvailable(appointment.dentistCode, newDate, appointment.duration);
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

module.exports = {
  getAppointments,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointment
};

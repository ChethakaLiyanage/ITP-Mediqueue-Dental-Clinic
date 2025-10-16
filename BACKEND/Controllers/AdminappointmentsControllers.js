const mongoose = require("mongoose");
const AppointmentModel = require("../Model/AppointmentModel");
const User = require("../Model/User");
const PatientModel = require("../Model/PatientModel");
const UnregisteredPatientModel = require("../Model/UnregisteredPatientModel");

// GET /admin/appointments/receptionist-activities
// Fetch appointments made by receptionists
exports.getReceptionistAppointmentActivities = async (req, res) => {
  try {
    const { receptionistId, dateRange, status } = req.query;
    
    // Build filter for appointments - only include those made by receptionists
    const filter = {
      createdByCode: { $regex: /^R-/, $options: 'i' } // Only appointments created by receptionists (codes starting with R-)
    };
    
    // Date range filtering
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filter.createdAt = { $gte: startDate };
      }
    }
    
    // Status filtering
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Fetch appointments
    const appointments = await AppointmentModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    
    // Filter by specific receptionist if provided
    let filteredAppointments = appointments;
    if (receptionistId) {
      // Find receptionist by ID to get their code
      const receptionist = await User.findById(receptionistId).lean();
      if (receptionist && receptionist.userCode) {
        filteredAppointments = appointments.filter(appointment => 
          appointment.createdByCode === receptionist.userCode
        );
      } else {
        filteredAppointments = [];
      }
    }
    
    console.log(`Found ${appointments.length} appointments created by receptionists`);
    console.log(`After filtering: ${filteredAppointments.length} appointments`);
    
    // Format the response for receptionist activities
    const activities = [];
    
    for (const appointment of filteredAppointments) {
      // Get patient information based on patient type
      let patientInfo = {
        name: 'Unknown Patient',
        phone: null,
        email: null,
        age: null
      };
      
      if (appointment.isGuestBooking && appointment.guestInfo) {
        // Guest booking
        patientInfo = {
          name: appointment.guestInfo.name,
          phone: appointment.guestInfo.phone,
          email: appointment.guestInfo.email,
          age: appointment.guestInfo.age
        };
      } else if (appointment.patient_code) {
        // Try to get registered patient info
        const patient = await PatientModel.findOne({ patientCode: appointment.patient_code })
          .populate('userId', 'name email phone gmail')
          .lean();
        
        if (patient && patient.userId) {
          patientInfo = {
            name: patient.userId.name,
            phone: patient.userId.phone,
            email: patient.userId.email || patient.userId.gmail,
            age: patient.dob ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null
          };
        } else {
          // Try unregistered patient as fallback
          const unregPatient = await UnregisteredPatientModel.findOne({ patientCode: appointment.patient_code }).lean();
          
          if (unregPatient) {
            patientInfo = {
              name: unregPatient.name,
              phone: unregPatient.phone,
              email: unregPatient.email,
              age: unregPatient.age
            };
          }
        }
      }
      
      // Use patient snapshot as fallback
      if (appointment.patientSnapshot && (!patientInfo.name || patientInfo.name === 'Unknown Patient')) {
        patientInfo = {
          name: appointment.patientSnapshot.name || 'Unknown Patient',
          phone: appointment.patientSnapshot.phone,
          email: appointment.patientSnapshot.email,
          age: appointment.patientSnapshot.age
        };
      }
      
      // Get receptionist details
      let receptionistDetails = null;
      
      if (appointment.createdByCode) {
        // Find receptionist by code
        const receptionist = await User.findOne({ 
          userCode: appointment.createdByCode,
          role: { $in: ['Receptionist', 'receptionist'] }
        }).lean();
        
        if (receptionist) {
          receptionistDetails = receptionist;
        }
      }
      
      // Format appointment time
      const appointmentDate = new Date(appointment.appointment_date);
      const appointmentTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      activities.push({
        id: appointment._id,
        appointmentCode: appointment.appointmentCode,
        patientName: patientInfo.name,
        patientCode: appointment.patient_code,
        patientPhone: patientInfo.phone,
        patientEmail: patientInfo.email,
        patientAge: patientInfo.age,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointmentTime,
        dentistCode: appointment.dentist_code,
        reason: appointment.reason,
        status: appointment.status,
        queueNo: appointment.queue_no,
        patientType: appointment.isGuestBooking ? 'guest' : 'registered',
        isRegisteredPatient: !appointment.isGuestBooking,
        receptionistId: receptionistDetails ? receptionistDetails._id : null,
        receptionistName: receptionistDetails ? receptionistDetails.name : 
                         (appointment.createdByCode ? `Receptionist ${appointment.createdByCode}` : 'Unknown Receptionist'),
        receptionistCode: receptionistDetails ? receptionistDetails.userCode : appointment.createdByCode,
        receptionistEmail: receptionistDetails ? receptionistDetails.email : null,
        createdAt: appointment.createdAt,
        acceptedAt: appointment.acceptedAt,
        acceptedBy: appointment.acceptedBy ? appointment.acceptedBy.name : null,
        isReceptionistActivity: true,
        activityType: 'Appointment Creation'
      });
    }
    
    return res.status(200).json({ 
      success: true,
      activities,
      total: activities.length,
      message: 'Receptionist appointment activities retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching receptionist appointment activities:', err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch receptionist appointment activities", 
      error: err.message 
    });
  }
};

// GET /admin/appointments/all
// Get all appointments for admin overview
exports.getAllAppointments = async (req, res) => {
  try {
    const { origin, status, patientType, dentistCode } = req.query;
    
    const filter = { isActive: true };
    
    if (origin && origin !== 'all') {
      filter.origin = origin;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (patientType && patientType !== 'all') {
      filter.patientType = patientType;
    }
    
    if (dentistCode) {
      filter.dentist_code = { $regex: dentistCode, $options: 'i' };
    }
    
    const appointments = await AppointmentModel.find(filter)
      .populate('createdBy', 'name email role userCode')
      .populate('acceptedBy', 'name email role userCode')
      .sort({ appointment_date: -1 })
      .lean();
    
    // Populate patient information for each appointment
    for (const appointment of appointments) {
      if (appointment.patientType === 'registered') {
        const patient = await PatientModel.findOne({ patientCode: appointment.patient_code })
          .populate('userId', 'name email phone gmail')
          .lean();
        
        if (patient) {
          appointment.patientDetails = patient;
        }
      } else if (appointment.patientType === 'unregistered') {
        const unregPatient = await UnregisteredPatientModel.findOne({ patientCode: appointment.patient_code }).lean();
        
        if (unregPatient) {
          appointment.unregisteredPatientDetails = unregPatient;
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      appointments,
      total: appointments.length,
      message: 'Appointments retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching appointments:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: err.message
    });
  }
};

// GET /admin/appointments/receptionists
// Get list of receptionists who have made appointments
exports.getActiveAppointmentReceptionists = async (req, res) => {
  try {
    // Find all appointments made by receptionists
    const appointments = await AppointmentModel.find({
      createdByCode: { $regex: /^R-/, $options: 'i' } // Only appointments created by receptionists
    }).lean();
    
    const receptionistMap = new Map();
    
    // Collect unique receptionists
    for (const appointment of appointments) {
      if (appointment.createdByCode) {
        // Find receptionist by code
        const receptionist = await User.findOne({ 
          userCode: appointment.createdByCode,
          role: { $in: ['Receptionist', 'receptionist'] }
        }).lean();
        
        if (receptionist && !receptionistMap.has(receptionist._id.toString())) {
          receptionistMap.set(receptionist._id.toString(), {
            id: receptionist._id,
            name: receptionist.name,
            email: receptionist.email,
            userCode: receptionist.userCode,
            role: receptionist.role
          });
        }
      }
    }
    
    const receptionists = Array.from(receptionistMap.values());
    
    return res.status(200).json({
      success: true,
      receptionists,
      total: receptionists.length,
      message: 'Active appointment receptionists retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching active appointment receptionists:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active appointment receptionists",
      error: err.message
    });
  }
};

// GET /admin/appointments/stats
// Get statistics for appointments made by receptionists
exports.getAppointmentActivityStats = async (req, res) => {
  try {
    const { dateRange = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1); // This year
    }
    
    // Get appointments in date range made by receptionists
    const appointments = await AppointmentModel.find({
      origin: 'receptionist',
      isActive: true,
      createdAt: { $gte: startDate }
    })
    .populate('createdBy', 'name userCode')
    .lean();
    
    // Calculate statistics
    let totalAppointments = appointments.length;
    let pendingAppointments = 0;
    let confirmedAppointments = 0;
    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let registeredPatients = 0;
    let unregisteredPatients = 0;
    
    const receptionistActivity = new Map();
    
    appointments.forEach(appointment => {
      // Status counts
      switch (appointment.status) {
        case 'pending':
          pendingAppointments++;
          break;
        case 'confirmed':
          confirmedAppointments++;
          break;
        case 'completed':
          completedAppointments++;
          break;
        case 'cancelled':
          cancelledAppointments++;
          break;
      }
      
      // Patient type counts
      if (appointment.patientType === 'registered') {
        registeredPatients++;
      } else {
        unregisteredPatients++;
      }
      
      // Receptionist activity tracking
      let receptionistCode = null;
      let receptionistName = null;
      
      if (appointment.createdBy) {
        receptionistCode = appointment.createdBy.userCode;
        receptionistName = appointment.createdBy.name;
      } else if (appointment.createdByCode) {
        receptionistCode = appointment.createdByCode;
        receptionistName = `Receptionist ${appointment.createdByCode}`;
      }
      
      if (receptionistCode) {
        if (!receptionistActivity.has(receptionistCode)) {
          receptionistActivity.set(receptionistCode, {
            receptionistCode,
            receptionistName,
            appointments: 0,
            registeredPatients: 0,
            unregisteredPatients: 0
          });
        }
        const stats = receptionistActivity.get(receptionistCode);
        stats.appointments++;
        
        if (appointment.patientType === 'registered') {
          stats.registeredPatients++;
        } else {
          stats.unregisteredPatients++;
        }
      }
    });
    
    const receptionistStats = Array.from(receptionistActivity.values());
    
    return res.status(200).json({
      success: true,
      stats: {
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        registeredPatients,
        unregisteredPatients,
        dateRange,
        startDate,
        receptionistStats
      },
      message: 'Appointment activity statistics retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching appointment activity stats:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointment activity statistics",
      error: err.message
    });
  }
};

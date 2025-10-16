const mongoose = require("mongoose");
const PatientModel = require("../Model/PatientModel");
const User = require("../Model/User");
const ReceptionistModel = require("../Model/ReceptionistModel");

// GET /admin/patients/receptionist-activities
// Fetch patient registrations by receptionists
exports.getReceptionistPatientActivities = async (req, res) => {
  try {
    const { receptionistId, dateRange, status } = req.query;
    
    // Build filter for patients - only include those registered by receptionists
    const filter = {
      $or: [
        { registeredBy: { $exists: true, $ne: null } },
        { registeredByCode: { $exists: true, $ne: null, $ne: "" } }
      ]
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
    
    // Fetch patients with populated user and receptionist data
    const patients = await PatientModel.find(filter)
      .populate('userId', 'name email phone gmail')
      .populate('registeredBy', 'name email userCode')
      .sort({ createdAt: -1 })
      .lean();
    
    // Filter by specific receptionist if provided
    let filteredPatients = patients;
    if (receptionistId) {
      filteredPatients = patients.filter(patient => {
        const registeredByReceptionist = patient.registeredBy && 
          patient.registeredBy._id.toString() === receptionistId;
        
        return registeredByReceptionist;
      });
    }
    
    // Format the response for receptionist activities
    const activities = [];
    
    for (const patient of filteredPatients) {
      // Get receptionist details
      let receptionistDetails = null;
      
      if (patient.registeredBy) {
        receptionistDetails = patient.registeredBy;
      } else if (patient.registeredByCode) {
        // Try to find receptionist by code if ObjectId reference is missing
        const receptionist = await User.findOne({ 
          userCode: patient.registeredByCode,
          role: { $in: ['Receptionist', 'receptionist'] }
        }).lean();
        
        if (receptionist) {
          receptionistDetails = receptionist;
        }
      }
      
      // Only include if we have receptionist information
      if (receptionistDetails) {
        // Calculate age from date of birth
        const age = patient.dob ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null;
        
        activities.push({
          id: patient._id,
          patientCode: patient.patientCode,
          patientName: patient.userId ? patient.userId.name : 'Unknown Patient',
          patientEmail: patient.userId ? (patient.userId.email || patient.userId.gmail) : null,
          patientPhone: patient.userId ? patient.userId.phone : null,
          nic: patient.nic,
          dateOfBirth: patient.dob,
          age: age,
          gender: patient.gender,
          address: patient.address,
          allergies: patient.allergies,
          registrationDate: patient.createdAt,
          receptionistId: receptionistDetails._id,
          receptionistName: receptionistDetails.name,
          receptionistCode: receptionistDetails.userCode || patient.registeredByCode,
          receptionistEmail: receptionistDetails.email,
          status: 'Active', // You can add a status field to PatientModel if needed
          isReceptionistActivity: true,
          activityType: 'Registration'
        });
      }
    }
    
    return res.status(200).json({ 
      success: true,
      activities,
      total: activities.length,
      message: 'Receptionist patient registration activities retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching receptionist patient activities:', err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch receptionist patient activities", 
      error: err.message 
    });
  }
};

// GET /admin/patients/all
// Get all patients for admin overview
exports.getAllPatients = async (req, res) => {
  try {
    const { registeredBy, gender, ageRange } = req.query;
    
    const filter = {};
    
    // Filter by receptionist who registered the patient
    if (registeredBy && registeredBy !== 'all') {
      filter.$or = [
        { registeredByCode: registeredBy },
        { registeredBy: mongoose.Types.ObjectId.isValid(registeredBy) ? registeredBy : null }
      ];
    }
    
    // Filter by gender
    if (gender && gender !== 'all') {
      filter.gender = gender;
    }
    
    // Age range filtering would require date calculation
    if (ageRange && ageRange !== 'all') {
      const now = new Date();
      let minDate, maxDate;
      
      switch (ageRange) {
        case 'child': // 0-17
          minDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
          maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'adult': // 18-64
          minDate = new Date(now.getFullYear() - 65, now.getMonth(), now.getDate());
          maxDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
          break;
        case 'senior': // 65+
          maxDate = new Date(now.getFullYear() - 65, now.getMonth(), now.getDate());
          break;
      }
      
      if (minDate || maxDate) {
        filter.dob = {};
        if (minDate) filter.dob.$gte = minDate;
        if (maxDate) filter.dob.$lte = maxDate;
      }
    }
    
    const patients = await PatientModel.find(filter)
      .populate('userId', 'name email phone gmail')
      .populate('registeredBy', 'name email userCode')
      .sort({ createdAt: -1 })
      .lean();
    
    // Calculate ages and format data
    const formattedPatients = patients.map(patient => {
      const age = patient.dob ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      
      return {
        ...patient,
        age,
        patientName: patient.userId ? patient.userId.name : 'Unknown Patient',
        patientEmail: patient.userId ? (patient.userId.email || patient.userId.gmail) : null,
        patientPhone: patient.userId ? patient.userId.phone : null,
        receptionistName: patient.registeredBy ? patient.registeredBy.name : null,
        receptionistCode: patient.registeredBy ? patient.registeredBy.userCode : patient.registeredByCode
      };
    });
    
    return res.status(200).json({
      success: true,
      patients: formattedPatients,
      total: formattedPatients.length,
      message: 'Patients retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching patients:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
      error: err.message
    });
  }
};

// GET /admin/patients/receptionists
// Get list of receptionists who have registered patients
exports.getActivePatientReceptionists = async (req, res) => {
  try {
    // Find all patients with receptionist registration info
    const patients = await PatientModel.find({
      $or: [
        { registeredBy: { $exists: true, $ne: null } },
        { registeredByCode: { $exists: true, $ne: null, $ne: "" } }
      ]
    })
    .populate('registeredBy', 'name email userCode')
    .lean();
    
    const receptionistMap = new Map();
    
    // Collect unique receptionists
    for (const patient of patients) {
      if (patient.registeredBy) {
        const id = patient.registeredBy._id.toString();
        receptionistMap.set(id, {
          id: patient.registeredBy._id,
          name: patient.registeredBy.name,
          email: patient.registeredBy.email,
          userCode: patient.registeredBy.userCode,
          role: 'Receptionist'
        });
      } else if (patient.registeredByCode) {
        // Try to find receptionist by code
        const receptionist = await User.findOne({ 
          userCode: patient.registeredByCode,
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
      message: 'Active patient registration receptionists retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching active patient receptionists:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active patient receptionists",
      error: err.message
    });
  }
};

// GET /admin/patients/stats
// Get statistics for patient registrations by receptionists
exports.getPatientRegistrationStats = async (req, res) => {
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
    
    // Get patients in date range
    const patients = await PatientModel.find({
      createdAt: { $gte: startDate },
      $or: [
        { registeredBy: { $exists: true, $ne: null } },
        { registeredByCode: { $exists: true, $ne: null, $ne: "" } }
      ]
    })
    .populate('registeredBy', 'name userCode')
    .lean();
    
    // Calculate statistics
    let totalPatients = patients.length;
    let malePatients = 0;
    let femalePatients = 0;
    let otherGenderPatients = 0;
    
    const receptionistActivity = new Map();
    const ageGroups = { child: 0, adult: 0, senior: 0 };
    
    patients.forEach(patient => {
      // Gender counts
      switch (patient.gender) {
        case 'Male':
          malePatients++;
          break;
        case 'Female':
          femalePatients++;
          break;
        default:
          otherGenderPatients++;
      }
      
      // Age group counts
      if (patient.dob) {
        const age = Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) {
          ageGroups.child++;
        } else if (age < 65) {
          ageGroups.adult++;
        } else {
          ageGroups.senior++;
        }
      }
      
      // Receptionist activity tracking
      let receptionistCode = null;
      let receptionistName = null;
      
      if (patient.registeredBy) {
        receptionistCode = patient.registeredBy.userCode;
        receptionistName = patient.registeredBy.name;
      } else if (patient.registeredByCode) {
        receptionistCode = patient.registeredByCode;
        receptionistName = `Receptionist ${patient.registeredByCode}`;
      }
      
      if (receptionistCode) {
        if (!receptionistActivity.has(receptionistCode)) {
          receptionistActivity.set(receptionistCode, {
            receptionistCode,
            receptionistName,
            registrations: 0
          });
        }
        receptionistActivity.get(receptionistCode).registrations++;
      }
    });
    
    const receptionistStats = Array.from(receptionistActivity.values());
    
    return res.status(200).json({
      success: true,
      stats: {
        totalPatients,
        malePatients,
        femalePatients,
        otherGenderPatients,
        ageGroups,
        dateRange,
        startDate,
        receptionistStats
      },
      message: 'Patient registration statistics retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching patient registration stats:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient registration statistics",
      error: err.message
    });
  }
};
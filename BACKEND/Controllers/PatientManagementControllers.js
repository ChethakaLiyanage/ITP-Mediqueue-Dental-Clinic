const mongoose = require("mongoose");
const PatientModel = require("../Model/PatientModel");
const UnregisteredPatientModel = require("../Model/UnregisteredPatientModel");
const User = require("../Model/User");

// GET /admin/patient-management/all
// Get all patients (both registered and unregistered) for admin patient management
exports.getAllPatientsForManagement = async (req, res) => {
  try {
    const { search, patientType, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build search filter
    const searchFilter = {};
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      searchFilter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }
    
    let allPatients = [];
    
    // Fetch registered patients if not filtered to unregistered only
    if (!patientType || patientType === 'all' || patientType === 'registered') {
      const registeredPatientsFilter = { ...searchFilter };
      
      // For registered patients, we need to search in the populated User data
      const registeredPatients = await PatientModel.find(registeredPatientsFilter)
        .populate('userId', 'name email phone gmail')
        .populate('registeredBy', 'name userCode')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .lean();
      
      // Filter by search in populated user data and format
      const formattedRegisteredPatients = registeredPatients
        .filter(patient => {
          if (!search || !search.trim()) return true;
          
          const searchTerm = search.trim().toLowerCase();
          const userName = patient.userId?.name?.toLowerCase() || '';
          const userEmail = patient.userId?.email?.toLowerCase() || patient.userId?.gmail?.toLowerCase() || '';
          
          return userName.includes(searchTerm) || userEmail.includes(searchTerm);
        })
        .map(patient => {
          const age = patient.dob ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null;
          
          return {
            id: patient._id,
            patientCode: patient.patientCode,
            name: patient.userId?.name || 'Unknown',
            email: patient.userId?.email || patient.userId?.gmail || null,
            phone: patient.userId?.phone || null,
            age: age,
            gender: patient.gender,
            address: patient.address,
            allergies: patient.allergies,
            nic: patient.nic,
            dateOfBirth: patient.dob,
            registeredBy: patient.registeredBy?.name || null,
            registeredByCode: patient.registeredBy?.userCode || patient.registeredByCode,
            createdAt: patient.createdAt,
            updatedAt: patient.updatedAt,
            patientType: 'registered',
            status: 'Active' // You can add a status field to PatientModel if needed
          };
        });
      
      allPatients = [...allPatients, ...formattedRegisteredPatients];
    }
    
    // Fetch unregistered patients if not filtered to registered only
    if (!patientType || patientType === 'all' || patientType === 'unregistered') {
      let unregisteredPatientsFilter = {};
      
      // Apply search filter for unregistered patients
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        unregisteredPatientsFilter.$or = [
          { name: searchRegex },
          { email: searchRegex }
        ];
      }
      
      const unregisteredPatients = await UnregisteredPatientModel.find(unregisteredPatientsFilter)
        .populate('createdBy', 'name userCode')
        .populate('addedBy', 'name userCode')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .lean();
      
      const formattedUnregisteredPatients = unregisteredPatients.map(patient => ({
        id: patient._id,
        patientCode: patient.unregisteredPatientCode,
        name: patient.name,
        email: patient.email || null,
        phone: patient.phone,
        age: patient.age,
        gender: null, // Unregistered patients don't have gender in the model
        address: null,
        allergies: null,
        nic: patient.identityNumber,
        dateOfBirth: null,
        registeredBy: patient.createdBy?.name || patient.addedBy?.name || null,
        registeredByCode: patient.createdBy?.userCode || patient.addedBy?.userCode || patient.createdByCode || patient.addedByCode,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
        patientType: 'unregistered',
        status: 'Temporary', // Unregistered patients are temporary
        notes: patient.notes,
        lastAppointmentCode: patient.lastAppointmentCode
      }));
      
      allPatients = [...allPatients, ...formattedUnregisteredPatients];
    }
    
    // Apply status filter
    if (status && status !== 'all') {
      allPatients = allPatients.filter(patient => 
        patient.status.toLowerCase() === status.toLowerCase()
      );
    }
    
    // Sort all patients together
    allPatients.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'desc') {
        return new Date(bValue) - new Date(aValue);
      } else {
        return new Date(aValue) - new Date(bValue);
      }
    });
    
    // Calculate statistics
    const stats = {
      total: allPatients.length,
      registered: allPatients.filter(p => p.patientType === 'registered').length,
      unregistered: allPatients.filter(p => p.patientType === 'unregistered').length,
      active: allPatients.filter(p => p.status === 'Active').length,
      temporary: allPatients.filter(p => p.status === 'Temporary').length
    };
    
    return res.status(200).json({
      success: true,
      patients: allPatients,
      stats,
      total: allPatients.length,
      message: 'Patients retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching patients for management:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
      error: err.message
    });
  }
};

// GET /admin/patient-management/stats
// Get patient statistics for dashboard
exports.getPatientStats = async (req, res) => {
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
    
    // Get registered patients
    const registeredPatients = await PatientModel.find({
      createdAt: { $gte: startDate }
    }).lean();
    
    // Get unregistered patients
    const unregisteredPatients = await UnregisteredPatientModel.find({
      createdAt: { $gte: startDate }
    }).lean();
    
    // Calculate age groups for registered patients
    const ageGroups = { child: 0, adult: 0, senior: 0, unknown: 0 };
    const genderGroups = { male: 0, female: 0, other: 0, unknown: 0 };
    
    registeredPatients.forEach(patient => {
      // Age groups
      if (patient.dob) {
        const age = Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) {
          ageGroups.child++;
        } else if (age < 65) {
          ageGroups.adult++;
        } else {
          ageGroups.senior++;
        }
      } else {
        ageGroups.unknown++;
      }
      
      // Gender groups
      switch (patient.gender?.toLowerCase()) {
        case 'male':
          genderGroups.male++;
          break;
        case 'female':
          genderGroups.female++;
          break;
        case 'other':
          genderGroups.other++;
          break;
        default:
          genderGroups.unknown++;
      }
    });
    
    // Add unregistered patients with known ages
    unregisteredPatients.forEach(patient => {
      if (patient.age) {
        if (patient.age < 18) {
          ageGroups.child++;
        } else if (patient.age < 65) {
          ageGroups.adult++;
        } else {
          ageGroups.senior++;
        }
      } else {
        ageGroups.unknown++;
      }
      
      // Unregistered patients don't have gender info
      genderGroups.unknown++;
    });
    
    const stats = {
      totalPatients: registeredPatients.length + unregisteredPatients.length,
      registeredPatients: registeredPatients.length,
      unregisteredPatients: unregisteredPatients.length,
      ageGroups,
      genderGroups,
      dateRange,
      startDate
    };
    
    return res.status(200).json({
      success: true,
      stats,
      message: 'Patient statistics retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching patient statistics:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient statistics",
      error: err.message
    });
  }
};

// GET /admin/patient-management/overview-stats
// Get overview statistics for admin dashboard
exports.getOverviewStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get registered patients count
    const totalRegisteredPatients = await PatientModel.countDocuments();
    const monthlyRegisteredPatients = await PatientModel.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const weeklyRegisteredPatients = await PatientModel.countDocuments({
      createdAt: { $gte: startOfWeek }
    });
    const todayRegisteredPatients = await PatientModel.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // Get unregistered patients count
    const totalUnregisteredPatients = await UnregisteredPatientModel.countDocuments();
    const monthlyUnregisteredPatients = await UnregisteredPatientModel.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const weeklyUnregisteredPatients = await UnregisteredPatientModel.countDocuments({
      createdAt: { $gte: startOfWeek }
    });
    const todayUnregisteredPatients = await UnregisteredPatientModel.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // Calculate total patients
    const totalPatients = totalRegisteredPatients + totalUnregisteredPatients;
    const monthlyPatients = monthlyRegisteredPatients + monthlyUnregisteredPatients;
    const weeklyPatients = weeklyRegisteredPatients + weeklyUnregisteredPatients;
    const todayPatients = todayRegisteredPatients + todayUnregisteredPatients;

    res.status(200).json({
      success: true,
      data: {
        total: {
          registered: totalRegisteredPatients,
          unregistered: totalUnregisteredPatients,
          total: totalPatients
        },
        monthly: {
          registered: monthlyRegisteredPatients,
          unregistered: monthlyUnregisteredPatients,
          total: monthlyPatients
        },
        weekly: {
          registered: weeklyRegisteredPatients,
          unregistered: weeklyUnregisteredPatients,
          total: weeklyPatients
        },
        today: {
          registered: todayRegisteredPatients,
          unregistered: todayUnregisteredPatients,
          total: todayPatients
        }
      }
    });
  } catch (err) {
    console.error("getOverviewStats error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overview statistics",
      error: err.message
    });
  }
};

// GET /admin/patient-management/debug
// Debug endpoint to check patient counts and data integrity
exports.debugPatientCounts = async (req, res) => {
  try {
    const registeredCount = await PatientModel.countDocuments();
    const unregisteredCount = await UnregisteredPatientModel.countDocuments();
    const userCount = await User.countDocuments({ role: 'Patient' });

    // Get sample data for debugging
    const sampleRegistered = await PatientModel.find().limit(3).lean();
    const sampleUnregistered = await UnregisteredPatientModel.find().limit(3).lean();
    const sampleUsers = await User.find({ role: 'Patient' }).limit(3).lean();

    res.status(200).json({
      success: true,
      data: {
        counts: {
          registeredPatients: registeredCount,
          unregisteredPatients: unregisteredCount,
          patientUsers: userCount,
          total: registeredCount + unregisteredCount
        },
        samples: {
          registeredPatients: sampleRegistered,
          unregisteredPatients: sampleUnregistered,
          patientUsers: sampleUsers
        }
      }
    });
  } catch (err) {
    console.error("debugPatientCounts error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to debug patient counts",
      error: err.message
    });
  }
};

// POST /admin/patient-management/create-test-unregistered
// Create a test unregistered patient for development/testing
exports.createTestUnregisteredPatient = async (req, res) => {
  try {
    const testPatientData = {
      name: req.body.name || 'Test Patient',
      email: req.body.email || `test${Date.now()}@example.com`,
      phone: req.body.phone || '0712345678',
      dob: req.body.dob || new Date('1990-01-01'),
      gender: req.body.gender || 'Other',
      address: req.body.address || 'Test Address',
      emergencyContact: req.body.emergencyContact || {
        name: 'Emergency Contact',
        phone: '0712345679',
        relationship: 'Friend'
      }
    };

    const newPatient = new UnregisteredPatientModel(testPatientData);
    await newPatient.save();

    res.status(201).json({
      success: true,
      message: 'Test unregistered patient created successfully',
      data: newPatient
    });
  } catch (err) {
    console.error("createTestUnregisteredPatient error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create test unregistered patient",
      error: err.message
    });
  }
};

// PUT /admin/patient-management/promote/:id
// Promote an unregistered patient to registered status
exports.promoteUnregisteredPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // User ID to link to
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to promote patient"
      });
    }
    
    // Find the unregistered patient
    const unregisteredPatient = await UnregisteredPatientModel.findById(id);
    if (!unregisteredPatient) {
      return res.status(404).json({
        success: false,
        message: "Unregistered patient not found"
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Create new registered patient
    const newPatient = new PatientModel({
      userId: userId,
      nic: unregisteredPatient.identityNumber || 'TEMP-' + Date.now(),
      dob: new Date(), // You might want to ask for this
      gender: 'Other', // Default, should be updated
      address: '',
      allergies: unregisteredPatient.notes,
      registeredByCode: unregisteredPatient.createdByCode || unregisteredPatient.addedByCode
    });
    
    await newPatient.save();
    
    // Delete the unregistered patient
    await UnregisteredPatientModel.findByIdAndDelete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Patient promoted to registered status successfully',
      patient: newPatient
    });
    
  } catch (err) {
    console.error('Error promoting patient:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to promote patient",
      error: err.message
    });
  }
};

// DELETE /admin/patient-management/:id
// Delete a patient (registered or unregistered)
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientType } = req.query;
    
    let deletedPatient;
    
    if (patientType === 'registered') {
      deletedPatient = await PatientModel.findByIdAndDelete(id);
    } else if (patientType === 'unregistered') {
      deletedPatient = await UnregisteredPatientModel.findByIdAndDelete(id);
    } else {
      // Try both models
      deletedPatient = await PatientModel.findByIdAndDelete(id) || 
                      await UnregisteredPatientModel.findByIdAndDelete(id);
    }
    
    if (!deletedPatient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully'
    });
    
  } catch (err) {
    console.error('Error deleting patient:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete patient",
      error: err.message
    });
  }
};

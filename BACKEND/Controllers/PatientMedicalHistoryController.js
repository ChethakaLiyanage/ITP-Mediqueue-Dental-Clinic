// Controllers/PatientMedicalHistoryController.js

const mongoose = require("mongoose");
const Treatmentplan = require("../Model/TreatmentplanModel");
const Prescription = require("../Model/PrescriptionModel");
const AppointmentModel = require("../Model/AppointmentModel");
const PatientModel = require("../Model/PatientModel");
const DentistModel = require("../Model/DentistModel");

/* --------------------------------- Patient Medical History Controllers --------------------------------- */

// GET /api/medical-history - Get comprehensive medical history for authenticated patient
const getMedicalHistory = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    // Get query parameters for filtering
    const { 
      startDate, 
      endDate, 
      dentistCode, 
      type, // 'all', 'treatments', 'prescriptions', 'appointments'
      limit = 50,
      page = 1 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const dateFilter = {};

    // Build date filter
    if (startDate || endDate) {
      dateFilter.created_date = {};
      if (startDate) dateFilter.created_date.$gte = new Date(startDate);
      if (endDate) dateFilter.created_date.$lte = new Date(endDate);
    }

    // Build dentist filter
    const dentistFilter = dentistCode ? { dentistCode: String(dentistCode).trim() } : {};

    let medicalHistory = [];

    // Get treatments (only completed/archived ones for medical history)
    if (type === 'all' || type === 'treatments' || !type) {
      const treatmentFilter = { 
        patientCode, 
        isDeleted: true,  // Only show archived/completed treatments
        status: "archived",  // Only show archived status
        ...dateFilter, 
        ...dentistFilter 
      };
      
      const treatments = await Treatmentplan.find(treatmentFilter)
        .sort({ created_date: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Enrich treatments with dentist info
      const enrichedTreatments = await Promise.all(
        treatments.map(async (treatment) => {
          try {
            const dentist = await DentistModel.findOne({ dentistCode: treatment.dentistCode }).lean();
            return {
              ...treatment,
              type: 'treatment',
              dentistName: dentist ? `${dentist.firstName} ${dentist.lastName}` : 'Unknown Dentist',
              dentistSpecialty: dentist?.specialty || 'General Dentistry'
            };
          } catch (err) {
            return {
              ...treatment,
              type: 'treatment',
              dentistName: 'Unknown Dentist',
              dentistSpecialty: 'General Dentistry'
            };
          }
        })
      );

      medicalHistory = [...medicalHistory, ...enrichedTreatments];
    }

    // Get prescriptions
    if (type === 'all' || type === 'prescriptions' || !type) {
      const prescriptionFilter = { 
        patientCode, 
        isActive: true, 
        ...dateFilter, 
        ...dentistFilter 
      };
      
      const prescriptions = await Prescription.find(prescriptionFilter)
        .sort({ issuedAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Enrich prescriptions with dentist info
      const enrichedPrescriptions = await Promise.all(
        prescriptions.map(async (prescription) => {
          try {
            const dentist = await DentistModel.findOne({ dentistCode: prescription.dentistCode }).lean();
            return {
              ...prescription,
              type: 'prescription',
              dentistName: dentist ? `${dentist.firstName} ${dentist.lastName}` : 'Unknown Dentist',
              dentistSpecialty: dentist?.specialty || 'General Dentistry',
              medicineCount: prescription.medicines?.length || 0
            };
          } catch (err) {
            return {
              ...prescription,
              type: 'prescription',
              dentistName: 'Unknown Dentist',
              dentistSpecialty: 'General Dentistry',
              medicineCount: prescription.medicines?.length || 0
            };
          }
        })
      );

      medicalHistory = [...medicalHistory, ...enrichedPrescriptions];
    }

    // Get appointments
    if (type === 'all' || type === 'appointments' || !type) {
      const appointmentFilter = { 
        patient_code: patientCode, 
        ...dateFilter 
      };
      
      const appointments = await AppointmentModel.find(appointmentFilter)
        .sort({ appointment_date: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Enrich appointments with dentist info
      const enrichedAppointments = await Promise.all(
        appointments.map(async (appointment) => {
          try {
            const dentist = await DentistModel.findOne({ dentistCode: appointment.dentist_code }).lean();
            return {
              ...appointment,
              type: 'appointment',
              dentistName: dentist ? `${dentist.firstName} ${dentist.lastName}` : 'Unknown Dentist',
              dentistSpecialty: dentist?.specialty || 'General Dentistry'
            };
          } catch (err) {
            return {
              ...appointment,
              type: 'appointment',
              dentistName: 'Unknown Dentist',
              dentistSpecialty: 'General Dentistry'
            };
          }
        })
      );

      medicalHistory = [...medicalHistory, ...enrichedAppointments];
    }

    // Sort combined history by date (most recent first)
    medicalHistory.sort((a, b) => {
      const dateA = a.created_date || a.issuedAt || a.appointment_date;
      const dateB = b.created_date || b.issuedAt || b.appointment_date;
      return new Date(dateB) - new Date(dateA);
    });

    // Get summary statistics
    const summary = await getMedicalHistorySummary(patientCode);

    return res.status(200).json({
      success: true,
      data: {
        medicalHistory: medicalHistory.slice(0, parseInt(limit)),
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: medicalHistory.length
        }
      }
    });

  } catch (error) {
    console.error("getMedicalHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve medical history",
      error: error.message
    });
  }
};

// GET /api/medical-history/summary - Get medical history summary statistics
const getMedicalHistorySummary = async (patientCode) => {
  try {
    const [treatmentCount, prescriptionCount, appointmentCount] = await Promise.all([
      Treatmentplan.countDocuments({ patientCode, isDeleted: true, status: "archived" }), // Only completed treatments
      Prescription.countDocuments({ patientCode, isActive: true }),
      AppointmentModel.countDocuments({ patient_code: patientCode })
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentTreatments, recentPrescriptions, recentAppointments] = await Promise.all([
      Treatmentplan.countDocuments({ 
        patientCode, 
        isDeleted: true, 
        status: "archived",
        created_date: { $gte: thirtyDaysAgo } 
      }),
      Prescription.countDocuments({ 
        patientCode, 
        isActive: true, 
        issuedAt: { $gte: thirtyDaysAgo } 
      }),
      AppointmentModel.countDocuments({ 
        patient_code: patientCode, 
        appointment_date: { $gte: thirtyDaysAgo } 
      })
    ]);

    return {
      total: {
        treatments: treatmentCount,
        prescriptions: prescriptionCount,
        appointments: appointmentCount
      },
      recent: {
        treatments: recentTreatments,
        prescriptions: recentPrescriptions,
        appointments: recentAppointments
      }
    };
  } catch (error) {
    console.error("getMedicalHistorySummary error:", error);
    return {
      total: { treatments: 0, prescriptions: 0, appointments: 0 },
      recent: { treatments: 0, prescriptions: 0, appointments: 0 }
    };
  }
};

// GET /api/medical-history/summary - Get summary endpoint
const getSummary = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const summary = await getMedicalHistorySummary(patientCode);

    return res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error("getSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve medical history summary",
      error: error.message
    });
  }
};

// GET /api/medical-history/export - Export medical history (PDF/CSV)
const exportMedicalHistory = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const { format = 'json', startDate, endDate } = req.query;
    
    // Get all medical history data
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.created_date = {};
      if (startDate) dateFilter.created_date.$gte = new Date(startDate);
      if (endDate) dateFilter.created_date.$lte = new Date(endDate);
    }

    // Get patient info
    const patient = await PatientModel.findOne({ patientCode }).lean();
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Get comprehensive medical history
    const [treatments, prescriptions, appointments] = await Promise.all([
      Treatmentplan.find({ patientCode, isDeleted: true, status: "archived", ...dateFilter }).lean(),
      Prescription.find({ patientCode, isActive: true, ...dateFilter }).lean(),
      AppointmentModel.find({ patient_code: patientCode, ...dateFilter }).lean()
    ]);

    const exportData = {
      patient: {
        name: `${patient.firstName} ${patient.lastName}`,
        patientCode: patient.patientCode,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth
      },
      exportDate: new Date().toISOString(),
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Present'
      },
      medicalHistory: {
        treatments: treatments.map(t => ({
          ...t,
          type: 'treatment'
        })),
        prescriptions: prescriptions.map(p => ({
          ...p,
          type: 'prescription'
        })),
        appointments: appointments.map(a => ({
          ...a,
          type: 'appointment'
        }))
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="medical-history-${patientCode}.json"`);
      return res.json(exportData);
    }

    // For other formats, you can implement CSV or PDF generation here
    return res.status(400).json({
      success: false,
      message: "Only JSON format is currently supported"
    });

  } catch (error) {
    console.error("exportMedicalHistory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export medical history",
      error: error.message
    });
  }
};

module.exports = {
  getMedicalHistory,
  getSummary,
  exportMedicalHistory
};

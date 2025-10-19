// Controllers/PatientMedicalHistoryController.js

const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Prescription = require("../Model/PrescriptionModel");
const Treatmentplan = require("../Model/TreatmentplanModel");
const Appointment = require("../Model/AppointmentModel");
const Queue = require("../Model/QueueModel");
const Dentist = require("../Model/DentistModel");
const User = require("../Model/User");
const PatientModel = require("../Model/PatientModel");

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

    // Get patient information including age
    const patient = await PatientModel.findOne({ patientCode }).populate('userId', 'name').lean();
    
    const patientInfo = {
      name: patient?.userId?.name || 'Unknown Patient',
      dob: patient?.dob || null,
      gender: patient?.gender || 'Unknown',
      age: null
    };

    // Calculate age if DOB is available
    if (patientInfo.dob) {
      const today = new Date();
      const birthDate = new Date(patientInfo.dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      patientInfo.age = age;
    }

    const { type, startDate, endDate, dentistCode } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate + "T23:59:59.999Z");
      }
    }

    let medicalHistory = [];

    // Get treatments (completed treatment plans)
    if (!type || type === 'all' || type === 'treatments') {
      const treatmentFilter = { 
        patientCode,
        deletedAt: { $exists: true } // Only completed treatments
      };
      
      if (dentistCode) treatmentFilter.dentistCode = dentistCode;
      if (Object.keys(dateFilter).length > 0) treatmentFilter.deletedAt = dateFilter;

      const treatments = await Treatmentplan.find(treatmentFilter)
        .populate('dentistCode', 'dentistCode')
        .lean();

      // Get dentist names for treatments
      const enrichedTreatments = await Promise.all(treatments.map(async (treatment) => {
        let dentistName = 'Unknown Dentist';
        try {
          const dentist = await Dentist.findOne({ dentistCode: treatment.dentistCode })
            .populate('userId', 'name')
            .lean();
          dentistName = dentist?.userId?.name || 'Unknown Dentist';
        } catch (err) {
          console.warn('Error fetching dentist name for treatment:', err);
        }

        return {
          _id: treatment._id,
          type: 'treatment',
          diagnosis: treatment.diagnosis,
          treatment_notes: treatment.treatment_notes,
          planCode: treatment.planCode,
          dentistName,
          dentistCode: treatment.dentistCode,
          created_date: treatment.deletedAt,
          deleteReason: treatment.deleteReason
        };
      }));

      medicalHistory = [...medicalHistory, ...enrichedTreatments];
    }

    // Get prescriptions
    if (!type || type === 'all' || type === 'prescriptions') {
      const prescriptionFilter = { patientCode };
      
      if (dentistCode) prescriptionFilter.dentistCode = dentistCode;
      if (Object.keys(dateFilter).length > 0) prescriptionFilter.issuedAt = dateFilter;

      const prescriptions = await Prescription.find(prescriptionFilter)
        .populate('plan_id', 'diagnosis planCode')
        .lean();

      // Get dentist names for prescriptions
      const enrichedPrescriptions = await Promise.all(prescriptions.map(async (prescription) => {
        let dentistName = 'Unknown Dentist';
        try {
          const dentist = await Dentist.findOne({ dentistCode: prescription.dentistCode })
            .populate('userId', 'name')
            .lean();
          dentistName = dentist?.userId?.name || 'Unknown Dentist';
        } catch (err) {
          console.warn('Error fetching dentist name for prescription:', err);
        }

        return {
          _id: prescription._id,
          type: 'prescription',
          prescriptionCode: prescription.prescriptionCode,
          medicines: prescription.medicines,
          medicineCount: prescription.medicines?.length || 0,
          dentistName,
          dentistCode: prescription.dentistCode,
          created_date: prescription.issuedAt,
          diagnosis: prescription.plan_id?.diagnosis || 'General prescription'
        };
      }));

      medicalHistory = [...medicalHistory, ...enrichedPrescriptions];
    }

    // Get appointments (both from appointments table and queue table)
    if (!type || type === 'all' || type === 'appointments') {
      // Get future appointments from appointments table
      const appointmentFilter = { patientCode };
      if (dentistCode) appointmentFilter.dentistCode = dentistCode;
      if (Object.keys(dateFilter).length > 0) appointmentFilter.appointmentDate = dateFilter;

      const appointments = await Appointment.find(appointmentFilter)
        .lean();

      // Get today's appointments from queue table
      const queueFilter = { patientCode };
      if (dentistCode) queueFilter.dentistCode = dentistCode;
      if (Object.keys(dateFilter).length > 0) queueFilter.date = dateFilter;

      const queueAppointments = await Queue.find(queueFilter)
        .lean();

      // Get dentist names for appointments
      const enrichedAppointments = await Promise.all(appointments.map(async (appointment) => {
        let dentistName = 'Unknown Dentist';
        try {
          const dentist = await Dentist.findOne({ dentistCode: appointment.dentistCode })
            .populate('userId', 'name')
            .lean();
          dentistName = dentist?.userId?.name || 'Unknown Dentist';
        } catch (err) {
          console.warn('Error fetching dentist name for appointment:', err);
        }

        return {
          _id: appointment._id,
          type: 'appointment',
          appointmentCode: appointment.appointmentCode,
          appointment_date: appointment.appointmentDate,
          status: appointment.status,
          reason: appointment.reason,
          notes: appointment.notes,
          dentistName,
          dentistCode: appointment.dentistCode,
          created_date: appointment.appointmentDate
        };
      }));

      // Get dentist names for queue appointments
      const enrichedQueueAppointments = await Promise.all(queueAppointments.map(async (queueAppointment) => {
        let dentistName = 'Unknown Dentist';
        try {
          const dentist = await Dentist.findOne({ dentistCode: queueAppointment.dentistCode })
            .populate('userId', 'name')
            .lean();
          dentistName = dentist?.userId?.name || 'Unknown Dentist';
        } catch (err) {
          console.warn('Error fetching dentist name for queue appointment:', err);
        }

        return {
          _id: queueAppointment._id,
          type: 'appointment',
          appointmentCode: queueAppointment.appointmentCode,
          appointment_date: queueAppointment.date,
          status: queueAppointment.status === 'waiting' ? 'confirmed' : queueAppointment.status,
          reason: queueAppointment.reason,
          notes: queueAppointment.notes,
          dentistName,
          dentistCode: queueAppointment.dentistCode,
          created_date: queueAppointment.date
        };
      }));

      medicalHistory = [...medicalHistory, ...enrichedAppointments, ...enrichedQueueAppointments];
    }

    // Sort by date (newest first)
    medicalHistory.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    return res.status(200).json({
      success: true,
      data: {
        patientInfo,
        medicalHistory,
        total: medicalHistory.length
      }
    });

  } catch (err) {
    console.error("getMedicalHistory error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch medical history" 
    });
  }
};

// GET /api/medical-history/summary - Get medical history summary statistics
const getMedicalHistorySummary = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total counts
    const [totalTreatments, totalPrescriptions, totalAppointments] = await Promise.all([
      Treatmentplan.countDocuments({ 
        patientCode, 
        deletedAt: { $exists: true } 
      }),
      Prescription.countDocuments({ patientCode }),
      Appointment.countDocuments({ patientCode })
    ]);

    // Get recent counts (this month)
    const [recentTreatments, recentPrescriptions, recentAppointments] = await Promise.all([
      Treatmentplan.countDocuments({ 
        patientCode, 
        deletedAt: { $exists: true, $gte: thisMonth } 
      }),
      Prescription.countDocuments({ 
        patientCode, 
        issuedAt: { $gte: thisMonth } 
      }),
      Appointment.countDocuments({ 
        patientCode, 
        appointmentDate: { $gte: thisMonth } 
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total: {
          treatments: totalTreatments,
          prescriptions: totalPrescriptions,
          appointments: totalAppointments
        },
        recent: {
          treatments: recentTreatments,
          prescriptions: recentPrescriptions,
          appointments: recentAppointments
        }
      }
    });

  } catch (err) {
    console.error("getMedicalHistorySummary error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch medical history summary" 
    });
  }
};

// GET /api/medical-history/export - Export medical history
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
    
    // Get patient information
    const patient = await PatientModel.findOne({ patientCode }).populate('userId', 'name').lean();
    
    const patientInfo = {
      name: patient?.userId?.name || 'Unknown Patient',
      dob: patient?.dob || null,
      gender: patient?.gender || 'Unknown',
      age: null
    };

    // Calculate age if DOB is available
    if (patientInfo.dob) {
      const today = new Date();
      const birthDate = new Date(patientInfo.dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      patientInfo.age = age;
    }
    
    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    // Get all medical history data with dentist names
    const [treatments, prescriptions, appointments] = await Promise.all([
      Treatmentplan.find({ 
        patientCode, 
        deletedAt: { $exists: true },
        ...(Object.keys(dateFilter).length > 0 ? { deletedAt: dateFilter } : {})
      }).populate('dentistCode', 'dentistCode').lean(),
      Prescription.find({ 
        patientCode,
        ...(Object.keys(dateFilter).length > 0 ? { issuedAt: dateFilter } : {})
      }).populate('dentistCode', 'dentistCode').lean(),
      Appointment.find({ 
        patientCode,
        ...(Object.keys(dateFilter).length > 0 ? { appointmentDate: dateFilter } : {})
      }).populate('dentistCode', 'dentistCode').lean()
    ]);

    // Get dentist names for all records
    const getDentistName = async (dentistCode) => {
      try {
        const dentist = await Dentist.findOne({ dentistCode })
          .populate('userId', 'name')
          .lean();
        return dentist?.userId?.name || 'Unknown Dentist';
      } catch (err) {
        return 'Unknown Dentist';
      }
    };

    const enrichedTreatments = await Promise.all(treatments.map(async (treatment) => ({
      ...treatment,
      dentistName: await getDentistName(treatment.dentistCode)
    })));

    const enrichedPrescriptions = await Promise.all(prescriptions.map(async (prescription) => ({
      ...prescription,
      dentistName: await getDentistName(prescription.dentistCode)
    })));

    const enrichedAppointments = await Promise.all(appointments.map(async (appointment) => ({
      ...appointment,
      dentistName: await getDentistName(appointment.dentistCode)
    })));

    const exportData = {
      patientInfo,
      patientCode,
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      summary: {
        totalTreatments: treatments.length,
        totalPrescriptions: prescriptions.length,
        totalAppointments: appointments.length
      },
      data: {
        treatments: enrichedTreatments,
        prescriptions: enrichedPrescriptions,
        appointments: enrichedAppointments
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="medical-history-${new Date().toISOString().split('T')[0]}.json"`);
      return res.json(exportData);
    } else if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument();
      const filename = `medical-history-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      doc.pipe(res);
      
      // PDF Header
      doc.fontSize(20).text('Medical History Report', 50, 50);
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80);
      doc.text(`Patient: ${patientInfo.name}`, 50, 100);
      if (patientInfo.age) {
        doc.text(`Age: ${patientInfo.age} years old`, 50, 120);
      }
      doc.text(`Gender: ${patientInfo.gender}`, 50, 140);
      
      let yPosition = 180;
      
      // Patient Summary
      doc.fontSize(16).text('Summary', 50, yPosition);
      yPosition += 30;
      doc.fontSize(12).text(`Total Treatments: ${exportData.summary.totalTreatments}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Total Prescriptions: ${exportData.summary.totalPrescriptions}`, 50, yPosition);
      yPosition += 20;
      doc.text(`Total Appointments: ${exportData.summary.totalAppointments}`, 50, yPosition);
      yPosition += 40;
      
      // Treatments Section
      if (enrichedTreatments.length > 0) {
        doc.fontSize(16).text('Completed Treatments', 50, yPosition);
        yPosition += 30;
        
        enrichedTreatments.forEach((treatment, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(14).text(`${index + 1}. ${treatment.diagnosis}`, 50, yPosition);
          yPosition += 20;
          doc.fontSize(10).text(`Dentist: Dr. ${treatment.dentistName}`, 70, yPosition);
          yPosition += 15;
          doc.text(`Completed: ${new Date(treatment.deletedAt).toLocaleDateString()}`, 70, yPosition);
          yPosition += 15;
          if (treatment.treatment_notes) {
            doc.text(`Notes: ${treatment.treatment_notes}`, 70, yPosition);
            yPosition += 15;
          }
          yPosition += 20;
        });
      }
      
      // Prescriptions Section
      if (enrichedPrescriptions.length > 0) {
        if (yPosition > 600) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(16).text('Prescriptions', 50, yPosition);
        yPosition += 30;
        
        enrichedPrescriptions.forEach((prescription, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(14).text(`${index + 1}. Prescription ${prescription.prescriptionCode}`, 50, yPosition);
          yPosition += 20;
          doc.fontSize(10).text(`Dentist: Dr. ${prescription.dentistName}`, 70, yPosition);
          yPosition += 15;
          doc.text(`Issued: ${new Date(prescription.issuedAt).toLocaleDateString()}`, 70, yPosition);
          yPosition += 15;
          doc.text(`Medicines: ${prescription.medicines?.length || 0}`, 70, yPosition);
          yPosition += 20;
        });
      }
      
      // Appointments Section
      if (enrichedAppointments.length > 0) {
        if (yPosition > 600) {
          doc.addPage();
          yPosition = 50;
        }
        
        doc.fontSize(16).text('Appointments', 50, yPosition);
        yPosition += 30;
        
        enrichedAppointments.forEach((appointment, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(14).text(`${index + 1}. Appointment with Dr. ${appointment.dentistName}`, 50, yPosition);
          yPosition += 20;
          doc.fontSize(10).text(`Date: ${new Date(appointment.appointmentDate).toLocaleDateString()}`, 70, yPosition);
          yPosition += 15;
          doc.text(`Status: ${appointment.status}`, 70, yPosition);
          yPosition += 15;
          if (appointment.reason) {
            doc.text(`Reason: ${appointment.reason}`, 70, yPosition);
            yPosition += 15;
          }
          yPosition += 20;
        });
      }
      
      doc.end();
    } else {
      return res.status(400).json({
        success: false,
        message: "Supported formats: json, pdf"
      });
    }

  } catch (err) {
    console.error("exportMedicalHistory error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to export medical history" 
    });
  }
};

module.exports = {
  getMedicalHistory,
  getMedicalHistorySummary,
  exportMedicalHistory
};
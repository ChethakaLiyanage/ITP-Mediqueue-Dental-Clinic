const Appointment = require('../Model/AppointmentModel');
const Notify = require('../Services/NotificationService');

// GET /api/appointments/:appointmentCode/pdf
const getAppointmentPdf = async (req, res) => {
  try {
    const { appointmentCode } = req.params;
    
    if (!appointmentCode) {
      return res.status(400).json({ message: 'Appointment code is required' });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({ appointmentCode }).lean();
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if user has access to this appointment
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Allow access if:
    // 1. User is the patient who owns the appointment
    // 2. User is a receptionist, dentist, or admin
    // 3. User is booking for someone else and this is their appointment
    let hasAccess = false;
    
    if (userRole === 'Receptionist' || userRole === 'Dentist' || userRole === 'Admin') {
      hasAccess = true;
    } else if (userId && appointment.patient_code) {
      // Check if this is the patient's appointment
      const Patient = require('../Model/PatientModel');
      const patient = await Patient.findOne({ patientCode: appointment.patient_code }).lean();
      if (patient && patient.userId && patient.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    } else if (userId && appointment.isBookingForSomeoneElse && appointment.bookerPatientCode) {
      // Check if user is the booker
      const Patient = require('../Model/PatientModel');
      const bookerPatient = await Patient.findOne({ patientCode: appointment.bookerPatientCode }).lean();
      if (bookerPatient && bookerPatient.userId && bookerPatient.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate PDF
    const appointmentDate = new Date(appointment.appointment_date);
    const contactInfo = await Notify.getPatientContact(appointment.patient_code);
    
    const pdfBuffer = await Notify.buildAppointmentPdf({
      patientType: appointment.patientType || (appointment.isGuestBooking ? 'unregistered' : 'registered'),
      patientCode: appointment.patient_code,
      patientName: contactInfo?.name || appointment.patientSnapshot?.name || appointment.guestInfo?.name,
      dentistCode: appointment.dentist_code,
      appointmentCode: appointment.appointmentCode,
      date: appointmentDate.toISOString().slice(0, 10),
      time: appointmentDate.toISOString().slice(11, 16),
      reason: appointment.reason,
      phone: contactInfo?.phone || appointment.guestInfo?.phone,
      email: contactInfo?.email || appointment.guestInfo?.email,
      nic: contactInfo?.nic || appointment.patientSnapshot?.nic,
      passport: contactInfo?.passport || appointment.patientSnapshot?.passport
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointmentCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[AppointmentPdf][error]', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};

// GET /api/appointments/:appointmentCode/confirmation-status
const getConfirmationStatus = async (req, res) => {
  try {
    const { appointmentCode } = req.params;
    
    if (!appointmentCode) {
      return res.status(400).json({ message: 'Appointment code is required' });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({ appointmentCode }).lean();
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check access (same logic as PDF endpoint)
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    let hasAccess = false;
    
    if (userRole === 'Receptionist' || userRole === 'Dentist' || userRole === 'Admin') {
      hasAccess = true;
    } else if (userId && appointment.patient_code) {
      const Patient = require('../Model/PatientModel');
      const patient = await Patient.findOne({ patientCode: appointment.patient_code }).lean();
      if (patient && patient.userId && patient.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    } else if (userId && appointment.isBookingForSomeoneElse && appointment.bookerPatientCode) {
      const Patient = require('../Model/PatientModel');
      const bookerPatient = await Patient.findOne({ patientCode: appointment.bookerPatientCode }).lean();
      if (bookerPatient && bookerPatient.userId && bookerPatient.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Return confirmation status
    res.json({
      appointmentCode: appointment.appointmentCode,
      status: appointment.status,
      confirmationStatus: appointment.confirmationStatus || {
        whatsappSent: false,
        whatsappSentAt: null,
        whatsappError: null,
        pdfSent: false,
        pdfSentAt: null,
        pdfError: null,
        confirmationMessage: null
      }
    });

  } catch (error) {
    console.error('[ConfirmationStatus][error]', error);
    res.status(500).json({ message: 'Failed to get confirmation status', error: error.message });
  }
};

module.exports = {
  getAppointmentPdf,
  getConfirmationStatus
};

const express = require('express');
const router = express.Router();
const { getAppointmentPdf, getConfirmationStatus } = require('../Controllers/AppointmentPdfController');
const requireAuth = require('../middleware/requireAuth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/appointments/:appointmentCode/pdf
router.get('/:appointmentCode/pdf', getAppointmentPdf);

// GET /api/appointments/:appointmentCode/confirmation-status
router.get('/:appointmentCode/confirmation-status', getConfirmationStatus);

module.exports = router;

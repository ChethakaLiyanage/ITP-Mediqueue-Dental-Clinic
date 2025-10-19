const express = require('express');
const inquiry_router = express.Router();
const inquiryController = require('../Controllers/InquiryControllers');
const requireAuth = require('../middleware/requireAuth');

// Test route to verify the router is working
inquiry_router.get('/test', (req, res) => {
  res.json({ message: 'Inquiry routes are working!' });
});

// Basic inquiry routes
inquiry_router.post('/', requireAuth, inquiryController.addInquiry);
inquiry_router.get('/', requireAuth, inquiryController.getAllInquiries);
inquiry_router.get('/:id', requireAuth, inquiryController.getById);
inquiry_router.put('/:id', requireAuth, inquiryController.updateInquiry);
inquiry_router.delete('/:id', requireAuth, inquiryController.deleteInquiry);

// Chat-specific routes
inquiry_router.get('/:inquiryId/messages', requireAuth, inquiryController.getInquiryWithMessages);
inquiry_router.post('/:inquiryId/messages', requireAuth, inquiryController.addMessage);

// Patient and receptionist specific routes
inquiry_router.get('/patient/:patientCode', requireAuth, inquiryController.getPatientInquiries);
inquiry_router.get('/receptionist/:receptionistCode', requireAuth, inquiryController.getReceptionistInquiries);

module.exports = inquiry_router;
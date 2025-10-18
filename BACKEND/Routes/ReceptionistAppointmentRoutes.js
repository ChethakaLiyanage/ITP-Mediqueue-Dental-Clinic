// Routes/ReceptionistAppointmentRoutes.js
const expressB = require('express');
const apptRouter = expressB.Router();
const ApptCtrl = require('../Controllers/ReceptionistAppointmentController');
const requireAuth = require('../middleware/requireAuth');

// Apply authentication middleware to all routes
apptRouter.use(requireAuth);

apptRouter.post('/', ApptCtrl.createByReceptionist);
apptRouter.post('/:appointmentCode/confirm', ApptCtrl.confirmAppointment);
apptRouter.post('/:appointmentCode/cancel', ApptCtrl.cancelAppointment);
apptRouter.patch('/:appointmentCode/reschedule', ApptCtrl.rescheduleAppointment);
apptRouter.get('/', ApptCtrl.listAppointmentsForDay);

// Add new update-related routes
apptRouter.patch('/:appointmentCode/update', ApptCtrl.updateByReceptionist);
apptRouter.post('/:appointmentCode/confirm-update', ApptCtrl.confirmUpdateAppointment);
apptRouter.post('/:appointmentCode/cancel-update', ApptCtrl.cancelUpdateAppointment);

// Send missing notifications for already confirmed appointments
apptRouter.post('/send-missing-notifications', ApptCtrl.sendMissingNotifications);

module.exports = apptRouter;

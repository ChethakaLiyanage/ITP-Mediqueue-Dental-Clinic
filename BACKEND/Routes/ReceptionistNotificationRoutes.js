const expressD = require('express');
const notifRouter = expressD.Router();
const NotifCtrl = require('../Controllers/ReceptionistNotificationController');
const requireAuth = require('../middleware/requireAuth');

// Apply authentication middleware to all routes
notifRouter.use(requireAuth);

// Test routes
notifRouter.post('/test', NotifCtrl.testSend);
notifRouter.get('/logs', NotifCtrl.listLogs);

// Main notification routes for receptionist
notifRouter.get('/appointments', NotifCtrl.listAppointmentNotifications);

module.exports = notifRouter;

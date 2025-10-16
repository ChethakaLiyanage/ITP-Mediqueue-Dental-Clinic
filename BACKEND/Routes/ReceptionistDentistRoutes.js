// Routes/ReceptionistDentistRoutes.js (READ-ONLY)
const expressE = require('express');
const dentistRouter = expressE.Router();
const DentCtrl = require('../Controllers/ReceptionistDentistController');

dentistRouter.get('/', DentCtrl.listDentistsPublic);

// NEW: list distinct specializations for dropdown (must be before :idOrCode)
dentistRouter.get('/specializations', DentCtrl.listDentistSpecializationsPublic);

dentistRouter.get('/:idOrCode', DentCtrl.getDentistPublic);

module.exports = dentistRouter;

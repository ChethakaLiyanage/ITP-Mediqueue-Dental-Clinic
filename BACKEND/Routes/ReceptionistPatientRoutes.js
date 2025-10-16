const express = require("express");
const router = express.Router();
const {
  listPatientsForReceptionist,
  getPatientForReceptionist,
  registerPatientForReceptionist,
} = require("../Controllers/ReceptionistPatientController");

// If you have auth middleware, place it here (and check role === 'Receptionist' or 'Manager')
// const { requireAuth, requireRole } = require("../middleware/auth");
// router.use(requireAuth, requireRole(["Receptionist","Manager"]));

router.post("/register", registerPatientForReceptionist);
router.get("/", listPatientsForReceptionist);
router.get("/:patientCode", getPatientForReceptionist);

module.exports = router;

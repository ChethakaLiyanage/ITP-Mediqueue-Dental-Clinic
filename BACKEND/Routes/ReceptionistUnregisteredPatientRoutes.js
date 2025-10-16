const express = require("express");
const router = express.Router();
const {
  createUnregisteredPatient,
  listUnregisteredPatients,
  getUnregisteredPatient,
} = require("../Controllers/UnregisteredPatientController");

router.post("/", createUnregisteredPatient);
router.get("/", listUnregisteredPatients);
router.get("/:code", getUnregisteredPatient);

module.exports = router;

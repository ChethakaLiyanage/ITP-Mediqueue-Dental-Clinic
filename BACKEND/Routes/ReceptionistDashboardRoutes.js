// Routes/ReceptionistDashboardRoutes.js
const express = require("express");
const router = express.Router();
const { getReceptionistDashboard } = require("../Controllers/ReceptionistDashboardController");

// GET /receptionist/dashboard?date=YYYY-MM-DD&tzOffsetMin=330
router.get("/dashboard", getReceptionistDashboard);

module.exports = router;

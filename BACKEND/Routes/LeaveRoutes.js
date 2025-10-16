const express = require("express");
const leave_router = express.Router();
const LeaveController = require("../Controllers/DentistLeaveControllers");
const { checkAvailability } = require("../Controllers/LeaveController");

leave_router.get("/", LeaveController.list);
leave_router.post("/", LeaveController.create);
leave_router.get("/check-availability", checkAvailability);

module.exports = leave_router;



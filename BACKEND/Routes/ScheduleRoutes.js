const express = require("express");
const router = express.Router();
const Schedule = require("../Controllers/ScheduleController");

router.get("/today", Schedule.getToday);

module.exports = router;



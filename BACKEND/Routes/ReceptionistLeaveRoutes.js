// backend/Routes/ReceptionistLeaveRoutes.js
const express = require("express");
const router = express.Router();
const {
  addLeave,
  listLeaves,
  updateLeave,
  deleteLeave,
} = require("../Controllers/ReceptionistLeaveController");

router.post("/", addLeave);
router.get("/", listLeaves);
router.put("/:id", updateLeave);
router.delete("/:id", deleteLeave);

module.exports = router;

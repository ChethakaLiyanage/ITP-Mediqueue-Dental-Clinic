const express = require("express");
const router = express.Router();

// Import manager report controller functions
const {
  getDashboardStats,
  getDentistPerformance,
  getInventoryReport,
  getPatientStatistics,
  getFinancialReport,
  getRecentActivity
} = require("../Controllers/ManagerReportController");

// Import middleware
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Manager reports route is working!" });
});

// Manager Reports Routes with authentication
router.get("/dashboard-stats", requireAuth, requireRole(["Manager", "Admin"]), getDashboardStats);
router.get("/recent-activity", requireAuth, requireRole(["Manager", "Admin"]), getRecentActivity);
router.get("/dentist-performance", requireAuth, requireRole(["Manager", "Admin"]), getDentistPerformance);
router.get("/inventory", requireAuth, requireRole(["Manager", "Admin"]), getInventoryReport);
router.get("/patients", requireAuth, requireRole(["Manager", "Admin"]), getPatientStatistics);
router.get("/financial", requireAuth, requireRole(["Manager", "Admin"]), getFinancialReport);

module.exports = router;
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

const {
  getAllInventoryRequests,
  getInventoryRequestById,
  createInventoryRequest,
  updateInventoryRequestStatus,
  deleteInventoryRequest,
  getInventoryRequestsByDentist,
  restoreInventoryQuantities
} = require("../Controllers/InventoryRequestControllers");

// All routes require authentication
router.use(requireAuth);

// Get all inventory requests
router.get("/", getAllInventoryRequests);

// Get inventory request by ID
router.get("/:id", getInventoryRequestById);

// Create new inventory request
router.post("/", createInventoryRequest);

// Update inventory request status
router.put("/:id/status", updateInventoryRequestStatus);

// Restore inventory quantities (for approved requests that need to be reverted)
router.post("/:id/restore", restoreInventoryQuantities);

// Delete inventory request
router.delete("/:id", deleteInventoryRequest);

// Get inventory requests by dentist
router.get("/dentist/:dentistCode", getInventoryRequestsByDentist);

module.exports = router;

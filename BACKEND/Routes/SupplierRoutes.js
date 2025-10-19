const express = require("express");
const router = express.Router();
const {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  getSupplierByCode,
  updateSupplier,
  deleteSupplier,
  permanentDeleteSupplier,
  reactivateSupplier,
  getSupplierStats,
  updateSupplierRating
} = require("../Controllers/SupplierControllers");

// Middleware imports
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

// Apply authentication and role-based access control
router.use(requireAuth);
router.use(requireRole(["Manager", "Admin"]));

// Supplier CRUD routes
router.post("/", createSupplier);
router.get("/", getAllSuppliers);
router.get("/stats", getSupplierStats);
router.get("/code/:code", getSupplierByCode);
router.get("/:id", getSupplierById);
router.put("/:id", updateSupplier);
router.patch("/:id/rating", updateSupplierRating);
router.patch("/:id/reactivate", reactivateSupplier);
router.delete("/:id", deleteSupplier);
router.delete("/:id/permanent", permanentDeleteSupplier);

module.exports = router;

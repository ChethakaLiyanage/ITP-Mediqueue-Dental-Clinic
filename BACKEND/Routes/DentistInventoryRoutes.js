const express = require("express");
const router = express.Router();
const InventoryController = require("../Controllers/DentistInventoryControllers");

// Catalog
router.get("/items", InventoryController.getInventoryItems);

// Requests
router.get("/requests", InventoryController.listInventoryRequests);
router.post("/requests", InventoryController.createInventoryRequest);

module.exports = router;


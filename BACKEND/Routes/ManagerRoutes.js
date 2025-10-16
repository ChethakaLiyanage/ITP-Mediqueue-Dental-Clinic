const express = require("express");
const manager_router = express.Router();
const managerController = require("../Controllers/ManagerControllers");

// Get all managers
manager_router.get("/", managerController.getAllManagers);

// Get manager by code
manager_router.get("/code/:managerCode", managerController.getManagerByCode);

// Get manager by ID
manager_router.get("/:id", managerController.getManagerById);

// Create a new manager
manager_router.post("/", managerController.createManager);

module.exports = manager_router;

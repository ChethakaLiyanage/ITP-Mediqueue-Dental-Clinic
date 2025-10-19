const express = require("express");
const router = express.Router();
const clinicEventController = require("../Controllers/ClinicEventControllers");

// Public route for home page
router.get("/public", clinicEventController.getPublicClinicEvents);

router.post("/", clinicEventController.addClinicEvent);
router.get("/", clinicEventController.getAllClinicEvents);
router.get("/:id", clinicEventController.getById);
router.get("/code/:code", clinicEventController.getByCode);
router.put("/:id", clinicEventController.updateClinicEvent);
router.delete("/:id", clinicEventController.deleteClinicEvent);

module.exports = router;

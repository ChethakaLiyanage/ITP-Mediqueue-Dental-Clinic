const express = require("express");
const event_router = express.Router();
const Events = require("../Controllers/DentistClinicEventControllers");
const { uploadEventImage, handleUploadError } = require("../middleware/uploadEventImage");
const requireAuth = require("../middleware/requireAuth");

// Public route for home page
event_router.get("/public", Events.getPublicClinicEvents);

// Fix image URL route
event_router.post("/fix-image", Events.fixEventImage);

// Auto-fix all event images
event_router.post("/auto-fix-images", Events.autoFixEventImages);

// Assign images chronologically
event_router.post("/assign-images", Events.assignImagesChronologically);

// list
event_router.get("/", requireAuth, Events.getAllEvents);

// create
event_router.post("/", requireAuth, uploadEventImage, handleUploadError, Events.addEvent);

// read
event_router.get("/code/:eventCode", Events.getByCode);
event_router.get("/:id", Events.getById);

// update
event_router.put("/:id", requireAuth, uploadEventImage, handleUploadError, Events.updateEvent);

// delete
event_router.delete("/:id", requireAuth, Events.deleteEvent);

module.exports = event_router;



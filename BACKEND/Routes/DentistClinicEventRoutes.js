const express = require("express");
const event_router = express.Router();
const Events = require("../Controllers/DentistClinicEventControllers");
const { uploadEventImage, handleUploadError } = require("../middleware/uploadEventImage");
const requireAuth = require("../middleware/requireAuth");

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



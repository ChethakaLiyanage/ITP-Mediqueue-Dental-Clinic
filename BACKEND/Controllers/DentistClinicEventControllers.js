const mongoose = require("mongoose");
const ClinicEvent = require("../Model/ClinicEventModel");
const Dentist = require("../Model/DentistModel");
const ScheduleService = require("../Services/ScheduleService");
const { uploadEventImage, handleUploadError } = require("../middleware/uploadEventImage");

// GET /events → only expose: eventCode, title, eventType, startDate, endDate
exports.getAllEvents = async (req, res) => {
  try {
    const { from, to, q, type, published, includeDeleted } = req.query;
    const filter = {};
    if (!includeDeleted) filter.isDeleted = false;
    if (type) filter.eventType = type;
    if (published && published !== "all") filter.isPublished = published === "true";
    if (from || to) {
      const start = from ? new Date(from) : new Date("0001-01-01");
      const end = to ? new Date(to) : new Date("9999-12-31");
      filter.$or = [{ startDate: { $lte: end }, endDate: { $gte: start } }];
    }
    if (q) {
      filter.$or = [ ...(filter.$or||[]), { title: { $regex: q, $options: "i" } } ];
    }
    const items = await ClinicEvent.find(filter)
      .select("_id eventCode title eventType startDate endDate allDay isPublished imageUrl description createdByCode updatedByCode createdAt updatedAt")
      .sort({ startDate: 1, title: 1 })
      .lean();
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to list clinic events", error: err.message });
  }
};

// POST /events
exports.addEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, allDay, eventType, isPublished, imageUrl } = req.body || {};
    if (!title || !startDate) return res.status(400).json({ message: "title and startDate are required" });

    // Handle image upload
    let finalImageUrl = imageUrl || null;
    if (req.file) {
      finalImageUrl = `/uploads/events/${req.file.filename}`;
    }

    // Get user information for audit fields
    const userId = req.user?._id || req.user?.id;
    const userCode = req.user?.receptionistCode || req.user?.dentistCode || req.user?.managerCode || req.user?.adminCode || req.user?.email || req.user?.name || 'Unknown';
    
    // Debug logging
    console.log('Create Event - User Info:', {
      userId,
      userCode,
      userRole: req.user?.role,
      receptionistCode: req.user?.receptionistCode,
      dentistCode: req.user?.dentistCode,
      managerCode: req.user?.managerCode,
      adminCode: req.user?.adminCode,
      email: req.user?.email,
      name: req.user?.name
    });

    const doc = {
      title,
      description: description || "",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      allDay: typeof allDay === "boolean" ? allDay : true,
      eventType: eventType || "Other",
      isPublished: !!isPublished,
      imageUrl: finalImageUrl,
      createdBy: userId,
      createdByCode: userCode,
    };
    const event = await ClinicEvent.create(doc);

    // Auto-update ScheduleModel - block slots for all dentists during clinic event
    try {
      // Get all dentists
      const dentists = await Dentist.find({}).select('dentistCode').lean();
      
      // Block slots for each dentist during the clinic event period
      for (const dentist of dentists) {
        await ScheduleService.blockSlots(
          dentist.dentistCode,
          event.startDate,
          event.endDate,
          'event',
          event._id.toString(),
          event.title || "Clinic Event",
          userCode
        );
      }
      
      console.log(`✅ Blocked ScheduleModel slots for dentist clinic event: ${event.eventCode} (${dentists.length} dentists)`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to block ScheduleModel slots for dentist clinic event ${event.eventCode}:`, scheduleError.message);
      // Don't fail the event creation if schedule update fails
    }

    return res.status(201).json({ event });
  } catch (err) {
    return res.status(500).json({ message: "Failed to create event", error: err.message });
  }
};

// GET /events/:id
exports.getById = async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const event = await ClinicEvent.findById(req.params.id).lean();
    if (!event || (!includeDeleted && event.isDeleted)) return res.status(404).json({ message: "Event not found" });
    return res.status(200).json({ event });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get event", error: err.message });
  }
};

// GET /events/code/:eventCode
exports.getByCode = async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const event = await ClinicEvent.findOne({ eventCode: req.params.eventCode }).lean();
    if (!event || (!includeDeleted && event.isDeleted)) return res.status(404).json({ message: "Event not found" });
    return res.status(200).json({ event });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get event", error: err.message });
  }
};

// PUT /events/:id
exports.updateEvent = async (req, res) => {
  try {
    const allowed = ["title","description","startDate","endDate","allDay","eventType","isPublished","imageUrl"];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);
    
    // Handle image upload
    if (req.file) {
      updates.imageUrl = `/uploads/events/${req.file.filename}`;
    }
    
    // Get user information for audit fields
    const userId = req.user?._id || req.user?.id;
    const userCode = req.user?.receptionistCode || req.user?.dentistCode || req.user?.managerCode || req.user?.adminCode || req.user?.email || req.user?.name || 'Unknown';
    
    // Debug logging
    console.log('Update Event - User Info:', {
      userId,
      userCode,
      userRole: req.user?.role,
      receptionistCode: req.user?.receptionistCode,
      dentistCode: req.user?.dentistCode,
      managerCode: req.user?.managerCode,
      adminCode: req.user?.adminCode,
      email: req.user?.email,
      name: req.user?.name
    });
    
    // Add audit fields
    updates.updatedBy = userId;
    updates.updatedByCode = userCode;
    
    const event = await ClinicEvent.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ message: "Event not found" });
    return res.status(200).json({ event });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update event", error: err.message });
  }
};

// DELETE /events/:id
exports.deleteEvent = async (req, res) => {
  try {
    const hard = String(req.query.hard || "").toLowerCase() === "true";
    if (hard) {
      const deleted = await ClinicEvent.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Event not found" });
      return res.status(200).json({ message: "Event hard-deleted", id: req.params.id });
    }
    const event = await ClinicEvent.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });
    return res.status(200).json({ message: "Event soft-deleted", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete event", error: err.message });
  }
};



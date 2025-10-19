const ClinicEvent = require("../Model/ClinicEventModel");
const Dentist = require("../Model/DentistModel");
const ScheduleService = require("../Services/ScheduleService");

// GET /api/clinic-events/public - Get published clinic events for public display
const getPublicClinicEvents = async (req, res) => {
  try {
    const { limit = 6, upcoming = true } = req.query;
    
    const filter = {
      isDeleted: false,
      isPublished: true
    };

    // If upcoming is true, only show future events
    if (upcoming === 'true') {
      filter.startDate = { $gte: new Date() };
    }

    const events = await ClinicEvent.find(filter)
      .select('eventCode title description startDate endDate allDay imageUrl')
      .sort({ startDate: 1 })
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        events,
        total: events.length
      }
    });

  } catch (err) {
    console.error("getPublicClinicEvents error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch clinic events" 
    });
  }
};

// ➤ Add Clinic Event
const addClinicEvent = async (req, res) => {
  try {
    const event = new ClinicEvent(req.body);
    await event.save();

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
          event.createdByCode || "system"
        );
      }
      
      console.log(`✅ Blocked ScheduleModel slots for clinic event: ${event.eventCode} (${dentists.length} dentists)`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to block ScheduleModel slots for clinic event ${event.eventCode}:`, scheduleError.message);
      // Don't fail the event creation if schedule update fails
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("addClinicEvent error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get All Clinic Events (Paginated)
const getAllClinicEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const events = await ClinicEvent.find({ isDeleted: { $ne: true } })
      .select("eventCode title description startDate endDate isPublished createdAt updatedAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await ClinicEvent.countDocuments({ isDeleted: { $ne: true } });
    res.status(200).json({ total, page, limit, events });
  } catch (err) {
    console.error("getAllClinicEvents error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Clinic Event by ID
const getById = async (req, res) => {
  try {
    const event = await ClinicEvent.findById(req.params.id)
      .select("eventCode title description startDate endDate isPublished createdAt updatedAt")
      .lean();

    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (err) {
    console.error("getById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Clinic Event by Code
const getByCode = async (req, res) => {
  try {
    const event = await ClinicEvent.findOne({ eventCode: req.params.code })
      .select("eventCode title description startDate endDate isPublished createdAt updatedAt")
      .lean();

    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (err) {
    console.error("getByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Update Clinic Event
const updateClinicEvent = async (req, res) => {
  try {
    // Get the existing event to compare changes
    const existingEvent = await ClinicEvent.findById(req.params.id);
    if (!existingEvent) return res.status(404).json({ message: "Event not found" });

    const event = await ClinicEvent.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).lean();

    if (!event) return res.status(404).json({ message: "Event not found" });

    // Auto-update ScheduleModel if dates changed
    const datesChanged = (
      existingEvent.startDate.getTime() !== new Date(event.startDate).getTime() ||
      existingEvent.endDate.getTime() !== new Date(event.endDate).getTime()
    );

    if (datesChanged) {
      try {
        // Get all dentists
        const dentists = await Dentist.find({}).select('dentistCode').lean();
        
        // Unblock old slots for all dentists
        for (const dentist of dentists) {
          await ScheduleService.unblockSlots(
            dentist.dentistCode,
            existingEvent.startDate,
            existingEvent.endDate,
            event.updatedByCode || "system"
          );
        }
        
        // Block new slots for all dentists
        for (const dentist of dentists) {
          await ScheduleService.blockSlots(
            dentist.dentistCode,
            event.startDate,
            event.endDate,
            'event',
            event._id.toString(),
            event.title || "Clinic Event",
            event.updatedByCode || "system"
          );
        }
        
        console.log(`✅ Updated ScheduleModel slots for clinic event update: ${event.eventCode} (${dentists.length} dentists)`);
      } catch (scheduleError) {
        console.error(`⚠️ Failed to update ScheduleModel slots for clinic event update ${event.eventCode}:`, scheduleError.message);
        // Don't fail the event update if schedule update fails
      }
    }

    res.status(200).json(event);
  } catch (err) {
    console.error("updateClinicEvent error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Delete Clinic Event (soft delete)
const deleteClinicEvent = async (req, res) => {
  try {
    const event = await ClinicEvent.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    ).lean();

    if (!event) return res.status(404).json({ message: "Event not found" });

    // Auto-update ScheduleModel - unblock slots for all dentists
    try {
      // Get all dentists
      const dentists = await Dentist.find({}).select('dentistCode').lean();
      
      // Unblock slots for each dentist during the clinic event period
      for (const dentist of dentists) {
        await ScheduleService.unblockSlots(
          dentist.dentistCode,
          event.startDate,
          event.endDate,
          event.deletedByCode || "system"
        );
      }
      
      console.log(`✅ Unblocked ScheduleModel slots for deleted clinic event: ${event.eventCode} (${dentists.length} dentists)`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to unblock ScheduleModel slots for deleted clinic event ${event.eventCode}:`, scheduleError.message);
      // Don't fail the deletion if schedule update fails
    }

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("deleteClinicEvent error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPublicClinicEvents = getPublicClinicEvents;
exports.addClinicEvent = addClinicEvent;
exports.getAllClinicEvents = getAllClinicEvents;
exports.getById = getById;
exports.getByCode = getByCode;
exports.updateClinicEvent = updateClinicEvent;
exports.deleteClinicEvent = deleteClinicEvent;

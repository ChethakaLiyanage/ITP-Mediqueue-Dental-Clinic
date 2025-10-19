const mongoose = require("mongoose");
const ClinicEvent = require("../Model/ClinicEventModel");
const Dentist = require("../Model/DentistModel");
const ScheduleService = require("../Services/ScheduleService");
const { uploadEventImage, handleUploadError } = require("../middleware/uploadEventImage");

// Fix image URL for specific event
exports.fixEventImage = async (req, res) => {
  try {
    const { eventCode, newImageUrl } = req.body;
    
    const result = await ClinicEvent.updateOne(
      { eventCode: eventCode },
      { imageUrl: newImageUrl }
    );
    
    return res.status(200).json({
      success: true,
      message: "Image URL updated successfully",
      result: result
    });
  } catch (err) {
    console.error("fixEventImage error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update image URL" 
    });
  }
};

// Manually assign images to events chronologically
exports.assignImagesChronologically = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get all events sorted by creation date
    const events = await ClinicEvent.find({ isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();
    
    // Get all image files sorted by creation date
    const uploadsDir = path.join(__dirname, '../uploads/events');
    const imageFiles = fs.readdirSync(uploadsDir)
      .filter(file => file.match(/\.(jpg|jpeg|png|webp)$/i))
      .map(file => ({
        name: file,
        path: path.join(uploadsDir, file),
        mtime: fs.statSync(path.join(uploadsDir, file)).mtime
      }))
      .sort((a, b) => a.mtime - b.mtime);
    
    let assignedCount = 0;
    
    // Assign images chronologically
    for (let i = 0; i < events.length && i < imageFiles.length; i++) {
      const event = events[i];
      const imageFile = imageFiles[i];
      
      const newImageUrl = `/uploads/events/${imageFile.name}`;
      
      await ClinicEvent.updateOne(
        { _id: event._id },
        { imageUrl: newImageUrl }
      );
      
      console.log(`Assigned ${imageFile.name} to ${event.eventCode} (${event.title})`);
      assignedCount++;
    }
    
    return res.status(200).json({
      success: true,
      message: `Assigned ${assignedCount} images chronologically`,
      assignedCount: assignedCount
    });
  } catch (err) {
    console.error("assignImagesChronologically error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to assign images chronologically" 
    });
  }
};

// Auto-fix all event images
exports.autoFixEventImages = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get all events
    const events = await ClinicEvent.find({ isDeleted: false });
    const uploadsDir = path.join(__dirname, '../uploads/events');
    
    let fixedCount = 0;
    
    // Get all available image files
    const allImageFiles = fs.readdirSync(uploadsDir).filter(file => 
      file.match(/\.(jpg|jpeg|png|webp)$/i)
    );
    
    for (const event of events) {
      if (event.imageUrl) {
        const currentImagePath = path.join(__dirname, '..', event.imageUrl);
        
        // Check if current image exists
        if (!fs.existsSync(currentImagePath)) {
          console.log(`Image not found for event ${event.eventCode}: ${event.imageUrl}`);
          
          // Try to find the correct image file with better matching
          let matchedFile = null;
          
          // First, try to match by event code
          const eventCodeMatch = allImageFiles.find(file => 
            file.includes(event.eventCode) || 
            file.includes(event.eventCode.replace('-', ''))
          );
          
          if (eventCodeMatch) {
            matchedFile = eventCodeMatch;
          } else {
            // Try to match by event ID (last 8 characters)
            const eventIdSuffix = event._id.toString().slice(-8);
            const eventIdMatch = allImageFiles.find(file => 
              file.includes(eventIdSuffix)
            );
            
            if (eventIdMatch) {
              matchedFile = eventIdMatch;
            } else {
              // Try to match by creation date proximity
              const eventCreatedAt = new Date(event.createdAt || event.updatedAt);
              const timeDiff = (file) => {
                const fileTime = fs.statSync(path.join(uploadsDir, file)).mtime;
                return Math.abs(fileTime - eventCreatedAt);
              };
              
              const closestFile = allImageFiles.reduce((closest, current) => {
                return timeDiff(current) < timeDiff(closest) ? current : closest;
              });
              
              matchedFile = closestFile;
            }
          }
          
          if (matchedFile) {
            const newImageUrl = `/uploads/events/${matchedFile}`;
            
            await ClinicEvent.updateOne(
              { _id: event._id },
              { imageUrl: newImageUrl }
            );
            
            console.log(`Fixed image for ${event.eventCode}: ${newImageUrl}`);
            fixedCount++;
          } else {
            console.log(`No suitable image found for event ${event.eventCode}`);
            // Remove the broken image URL
            await ClinicEvent.updateOne(
              { _id: event._id },
              { imageUrl: null }
            );
          }
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Auto-fixed ${fixedCount} event images`,
      fixedCount: fixedCount
    });
  } catch (err) {
    console.error("autoFixEventImages error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to auto-fix event images" 
    });
  }
};

// GET /events/public - Get published clinic events for public display
exports.getPublicClinicEvents = async (req, res) => {
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

    // Auto-fix image URLs for events with broken images
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads/events');
    
    // Get all available image files
    const allImageFiles = fs.readdirSync(uploadsDir).filter(file => 
      file.match(/\.(jpg|jpeg|png|webp)$/i)
    );
    
    for (const event of events) {
      if (event.imageUrl) {
        const currentImagePath = path.join(__dirname, '..', event.imageUrl);
        
        // Check if current image exists
        if (!fs.existsSync(currentImagePath)) {
          console.log(`Auto-fixing broken image for event ${event.eventCode}`);
          
          // Try to find the correct image file with better matching
          let matchedFile = null;
          
          // First, try to match by event code
          const eventCodeMatch = allImageFiles.find(file => 
            file.includes(event.eventCode) || 
            file.includes(event.eventCode.replace('-', ''))
          );
          
          if (eventCodeMatch) {
            matchedFile = eventCodeMatch;
          } else {
            // Try to match by event ID (last 8 characters)
            const eventIdSuffix = event._id.toString().slice(-8);
            const eventIdMatch = allImageFiles.find(file => 
              file.includes(eventIdSuffix)
            );
            
            if (eventIdMatch) {
              matchedFile = eventIdMatch;
            } else {
              // Try to match by creation date proximity
              const eventCreatedAt = new Date(event.createdAt || event.updatedAt);
              const timeDiff = (file) => {
                const fileTime = fs.statSync(path.join(uploadsDir, file)).mtime;
                return Math.abs(fileTime - eventCreatedAt);
              };
              
              const closestFile = allImageFiles.reduce((closest, current) => {
                return timeDiff(current) < timeDiff(closest) ? current : closest;
              });
              
              matchedFile = closestFile;
            }
          }
          
          if (matchedFile) {
            event.imageUrl = `/uploads/events/${matchedFile}`;
            console.log(`Auto-fixed image for ${event.eventCode}: ${event.imageUrl}`);
          } else {
            console.log(`No suitable image found for event ${event.eventCode}`);
            // Remove the broken image URL
            event.imageUrl = null;
          }
        }
      }
    }

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



const mongoose = require("mongoose");
const ClinicEvent = require("../Model/ClinicEventModel");
const User = require("../Model/User");

// GET /admin/clinic-events/receptionist-activities
// Fetch clinic events with receptionist activity tracking
exports.getReceptionistActivities = async (req, res) => {
  try {
    const { receptionistId, dateRange, status } = req.query;
    
    // Build filter for clinic events
    const filter = { isDeleted: false };
    
    // Date range filtering
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filter.updatedAt = { $gte: startDate };
      }
    }
    
    // Status filtering
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.isPublished = true;
      } else if (status === 'inactive') {
        filter.isPublished = false;
      }
    }
    
    // Fetch clinic events with populated user data
    const events = await ClinicEvent.find(filter)
      .populate('createdBy', 'name email role userCode')
      .populate('updatedBy', 'name email role userCode')
      .sort({ updatedAt: -1 })
      .lean();
    
    // Filter by receptionist if specified
    let filteredEvents = events;
    if (receptionistId) {
      filteredEvents = events.filter(event => {
        const createdByReceptionist = event.createdBy && 
          (event.createdBy.role === 'Receptionist' || event.createdBy.role === 'receptionist') &&
          event.createdBy._id.toString() === receptionistId;
        
        const updatedByReceptionist = event.updatedBy && 
          (event.updatedBy.role === 'Receptionist' || event.updatedBy.role === 'receptionist') &&
          event.updatedBy._id.toString() === receptionistId;
        
        return createdByReceptionist || updatedByReceptionist;
      });
    } else {
      // Show events that were created or updated by receptionists, or events without user references (for admin visibility)
      filteredEvents = events.filter(event => {
        const createdByReceptionist = event.createdBy && 
          (event.createdBy.role === 'Receptionist' || event.createdBy.role === 'receptionist');
        
        const updatedByReceptionist = event.updatedBy && 
          (event.updatedBy.role === 'Receptionist' || event.updatedBy.role === 'receptionist');
        
        // Also include events without user references (manual entries or system events)
        const noUserReferences = !event.createdBy && !event.updatedBy;
        
        return createdByReceptionist || updatedByReceptionist || noUserReferences;
      });
    }
    
    // Format the response for receptionist activities
    const activities = filteredEvents.map(event => ({
      id: event._id,
      eventCode: event.eventCode,
      eventTitle: event.title,
      eventDate: event.startDate,
      eventType: event.eventType,
      description: event.description,
      isPublished: event.isPublished,
      status: event.isPublished ? 'Active' : 'Inactive',
      
      // Creator information
      createdBy: event.createdBy ? event.createdBy.name : (event.createdByCode ? `User (${event.createdByCode})` : 'System/Manual'),
      createdByCode: event.createdBy ? event.createdBy.userCode : (event.createdByCode || 'N/A'),
      createdByRole: event.createdBy ? event.createdBy.role : 'System',
      createdAt: event.createdAt,
      
      // Last updater information (receptionist activity)
      updatedBy: event.updatedBy ? event.updatedBy.name : 
                 (event.createdBy ? event.createdBy.name : 
                 (event.updatedByCode ? `User (${event.updatedByCode})` : 'System/Manual')),
      updatedByCode: event.updatedBy ? event.updatedBy.userCode : 
                     (event.createdBy ? event.createdBy.userCode : 
                     (event.updatedByCode || event.createdByCode || 'N/A')),
      updatedByRole: event.updatedBy ? event.updatedBy.role : 
                     (event.createdBy ? event.createdBy.role : 'System'),
      receptionistId: event.updatedBy ? event.updatedBy._id : 
                      (event.createdBy ? event.createdBy._id : null),
      receptionistName: event.updatedBy ? event.updatedBy.name : 
                        (event.createdBy ? event.createdBy.name : 'System/Manual'),
      lastUpdated: event.updatedAt,
      
      // Activity type
      activityType: event.updatedBy ? 'Updated' : 
                    (event.createdBy ? 'Created' : 'System Entry'),
      isReceptionistActivity: !!(event.createdBy || event.updatedBy)
    }));
    
    return res.status(200).json({ 
      success: true,
      activities,
      total: activities.length,
      message: 'Receptionist clinic event activities retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching receptionist activities:', err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch receptionist clinic event activities", 
      error: err.message 
    });
  }
};

// GET /admin/clinic-events/all
// Get all clinic events for admin overview
exports.getAllClinicEvents = async (req, res) => {
  try {
    const { includeDeleted = false, eventType, isPublished } = req.query;
    
    const filter = {};
    if (!includeDeleted) {
      filter.isDeleted = false;
    }
    
    if (eventType && eventType !== 'all') {
      filter.eventType = eventType;
    }
    
    if (isPublished !== undefined && isPublished !== 'all') {
      filter.isPublished = isPublished === 'true';
    }
    
    const events = await ClinicEvent.find(filter)
      .populate('createdBy', 'name email role userCode')
      .populate('updatedBy', 'name email role userCode')
      .sort({ startDate: -1 })
      .lean();
    
    return res.status(200).json({
      success: true,
      events,
      total: events.length,
      message: 'Clinic events retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching clinic events:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch clinic events",
      error: err.message
    });
  }
};

// GET /admin/clinic-events/receptionists
// Get list of receptionists who have worked on clinic events
exports.getActiveReceptionists = async (req, res) => {
  try {
    // Find all clinic events and get unique receptionist IDs
    const events = await ClinicEvent.find({ isDeleted: false })
      .populate('createdBy', 'name email role userCode')
      .populate('updatedBy', 'name email role userCode')
      .lean();
    
    const receptionistIds = new Set();
    const receptionistMap = new Map();
    
    events.forEach(event => {
      // Check creator
      if (event.createdBy && 
          (event.createdBy.role === 'Receptionist' || event.createdBy.role === 'receptionist')) {
        const id = event.createdBy._id.toString();
        receptionistIds.add(id);
        receptionistMap.set(id, {
          id: event.createdBy._id,
          name: event.createdBy.name,
          email: event.createdBy.email,
          userCode: event.createdBy.userCode,
          role: event.createdBy.role
        });
      }
      
      // Check updater
      if (event.updatedBy && 
          (event.updatedBy.role === 'Receptionist' || event.updatedBy.role === 'receptionist')) {
        const id = event.updatedBy._id.toString();
        receptionistIds.add(id);
        receptionistMap.set(id, {
          id: event.updatedBy._id,
          name: event.updatedBy.name,
          email: event.updatedBy.email,
          userCode: event.updatedBy.userCode,
          role: event.updatedBy.role
        });
      }
    });
    
    const receptionists = Array.from(receptionistMap.values());
    
    return res.status(200).json({
      success: true,
      receptionists,
      total: receptionists.length,
      message: 'Active receptionists retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching active receptionists:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active receptionists",
      error: err.message
    });
  }
};

// GET /admin/clinic-events/stats
// Get statistics for receptionist activities on clinic events
exports.getReceptionistActivityStats = async (req, res) => {
  try {
    const { dateRange = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1); // This year
    }
    
    // Get events in date range
    const events = await ClinicEvent.find({
      isDeleted: false,
      $or: [
        { createdAt: { $gte: startDate } },
        { updatedAt: { $gte: startDate } }
      ]
    })
    .populate('createdBy', 'name role')
    .populate('updatedBy', 'name role')
    .lean();
    
    // Calculate statistics
    let totalEvents = 0;
    let eventsCreatedByReceptionists = 0;
    let eventsUpdatedByReceptionists = 0;
    let activeEvents = 0;
    let inactiveEvents = 0;
    
    const receptionistActivity = new Map();
    
    events.forEach(event => {
      totalEvents++;
      
      if (event.isPublished) {
        activeEvents++;
      } else {
        inactiveEvents++;
      }
      
      // Check if created by receptionist
      if (event.createdBy && 
          (event.createdBy.role === 'Receptionist' || event.createdBy.role === 'receptionist')) {
        eventsCreatedByReceptionists++;
        
        const name = event.createdBy.name;
        if (!receptionistActivity.has(name)) {
          receptionistActivity.set(name, { created: 0, updated: 0 });
        }
        receptionistActivity.get(name).created++;
      }
      
      // Check if updated by receptionist
      if (event.updatedBy && 
          (event.updatedBy.role === 'Receptionist' || event.updatedBy.role === 'receptionist')) {
        eventsUpdatedByReceptionists++;
        
        const name = event.updatedBy.name;
        if (!receptionistActivity.has(name)) {
          receptionistActivity.set(name, { created: 0, updated: 0 });
        }
        receptionistActivity.get(name).updated++;
      }
    });
    
    const receptionistStats = Array.from(receptionistActivity.entries()).map(([name, stats]) => ({
      receptionistName: name,
      eventsCreated: stats.created,
      eventsUpdated: stats.updated,
      totalActivity: stats.created + stats.updated
    }));
    
    return res.status(200).json({
      success: true,
      stats: {
        totalEvents,
        eventsCreatedByReceptionists,
        eventsUpdatedByReceptionists,
        activeEvents,
        inactiveEvents,
        dateRange,
        startDate,
        receptionistStats
      },
      message: 'Receptionist activity statistics retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching receptionist activity stats:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch receptionist activity statistics",
      error: err.message
    });
  }
};
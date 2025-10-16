const mongoose = require("mongoose");
const InquiryModel = require("../Model/InquiryModel");
const User = require("../Model/User");

// GET /admin/inquiries/receptionist-activities
// Fetch inquiry responses with receptionist activity tracking
exports.getReceptionistInquiryActivities = async (req, res) => {
  try {
    const { receptionistId, dateRange, status } = req.query;
    
    // Build filter for inquiries
    const filter = {};
    
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
        filter.$or = [
          { createdAt: { $gte: startDate } },
          { updatedAt: { $gte: startDate } },
          { 'responses.at': { $gte: startDate } }
        ];
      }
    }
    
    // Status filtering
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Fetch inquiries
    const inquiries = await InquiryModel.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    
    // Process inquiries to extract receptionist activities
    const activities = [];
    
    for (const inquiry of inquiries) {
      // Check if inquiry has responses from receptionists
      if (inquiry.responses && inquiry.responses.length > 0) {
        for (const response of inquiry.responses) {
          // Filter by specific receptionist if provided
          if (receptionistId) {
            // Find receptionist by userCode
            const receptionist = await User.findOne({ 
              userCode: response.receptionistCode,
              role: { $in: ['Receptionist', 'receptionist'] }
            }).lean();
            
            if (!receptionist || receptionist._id.toString() !== receptionistId) {
              continue;
            }
          }
          
          // Get receptionist details
          const receptionist = await User.findOne({ 
            userCode: response.receptionistCode 
          }).lean();
          
          // Calculate response time
          const inquiryDate = new Date(inquiry.createdAt);
          const responseDate = new Date(response.at);
          const timeDiff = responseDate - inquiryDate;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          
          let responseTime;
          if (hours > 24) {
            const days = Math.floor(hours / 24);
            responseTime = `${days} day${days > 1 ? 's' : ''}`;
          } else if (hours > 0) {
            responseTime = `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? minutes + ' min' : ''}`;
          } else {
            responseTime = `${minutes} minute${minutes > 1 ? 's' : ''}`;
          }
          
          activities.push({
            id: `${inquiry._id}_${response.at}`,
            inquiryCode: inquiry.inquiryCode,
            inquirySubject: inquiry.subject,
            inquiryMessage: inquiry.message,
            patientCode: inquiry.patientCode,
            patientName: `Patient ${inquiry.patientCode}`, // You might want to populate this from Patient model
            inquiryDate: inquiry.createdAt,
            responseDate: response.at,
            responseText: response.text,
            receptionistCode: response.receptionistCode,
            receptionistName: receptionist ? receptionist.name : `Receptionist ${response.receptionistCode}`,
            receptionistId: receptionist ? receptionist._id : null,
            receptionistEmail: receptionist ? receptionist.email : null,
            responseTime: responseTime,
            status: inquiry.status,
            assignedTo: inquiry.assignedTo,
            isReceptionistActivity: true,
            activityType: 'Response'
          });
        }
      }
      
      // Also include inquiries assigned to receptionists (even without responses yet)
      if (inquiry.assignedTo) {
        const assignedReceptionist = await User.findOne({ 
          userCode: inquiry.assignedTo,
          role: { $in: ['Receptionist', 'receptionist'] }
        }).lean();
        
        if (assignedReceptionist) {
          // Filter by specific receptionist if provided
          if (receptionistId && assignedReceptionist._id.toString() !== receptionistId) {
            continue;
          }
          
          // Only add if not already added through responses
          const hasResponse = inquiry.responses && inquiry.responses.some(r => r.receptionistCode === inquiry.assignedTo);
          if (!hasResponse) {
            activities.push({
              id: `${inquiry._id}_assigned`,
              inquiryCode: inquiry.inquiryCode,
              inquirySubject: inquiry.subject,
              inquiryMessage: inquiry.message,
              patientCode: inquiry.patientCode,
              patientName: `Patient ${inquiry.patientCode}`,
              inquiryDate: inquiry.createdAt,
              responseDate: null,
              responseText: null,
              receptionistCode: inquiry.assignedTo,
              receptionistName: assignedReceptionist.name,
              receptionistId: assignedReceptionist._id,
              receptionistEmail: assignedReceptionist.email,
              responseTime: null,
              status: inquiry.status,
              assignedTo: inquiry.assignedTo,
              isReceptionistActivity: true,
              activityType: 'Assigned'
            });
          }
        }
      }
    }
    
    // Sort activities by most recent first
    activities.sort((a, b) => {
      const dateA = a.responseDate || a.inquiryDate;
      const dateB = b.responseDate || b.inquiryDate;
      return new Date(dateB) - new Date(dateA);
    });
    
    return res.status(200).json({ 
      success: true,
      activities,
      total: activities.length,
      message: 'Receptionist inquiry activities retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching receptionist inquiry activities:', err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch receptionist inquiry activities", 
      error: err.message 
    });
  }
};

// GET /admin/inquiries/all
// Get all inquiries for admin overview
exports.getAllInquiries = async (req, res) => {
  try {
    const { status, assignedTo, patientCode } = req.query;
    
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      filter.assignedTo = assignedTo;
    }
    
    if (patientCode) {
      filter.patientCode = { $regex: patientCode, $options: 'i' };
    }
    
    const inquiries = await InquiryModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    
    // Populate receptionist details for assigned inquiries
    for (const inquiry of inquiries) {
      if (inquiry.assignedTo) {
        const receptionist = await User.findOne({ 
          userCode: inquiry.assignedTo 
        }).select('name email role').lean();
        
        if (receptionist) {
          inquiry.assignedReceptionist = receptionist;
        }
      }
      
      // Populate receptionist details for responses
      if (inquiry.responses && inquiry.responses.length > 0) {
        for (const response of inquiry.responses) {
          const receptionist = await User.findOne({ 
            userCode: response.receptionistCode 
          }).select('name email role').lean();
          
          if (receptionist) {
            response.receptionistDetails = receptionist;
          }
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      inquiries,
      total: inquiries.length,
      message: 'Inquiries retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching inquiries:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch inquiries",
      error: err.message
    });
  }
};

// GET /admin/inquiries/receptionists
// Get list of receptionists who have worked on inquiries
exports.getActiveInquiryReceptionists = async (req, res) => {
  try {
    // Find all inquiries and get unique receptionist codes
    const inquiries = await InquiryModel.find({}).lean();
    
    const receptionistCodes = new Set();
    
    inquiries.forEach(inquiry => {
      // From assigned receptionists
      if (inquiry.assignedTo) {
        receptionistCodes.add(inquiry.assignedTo);
      }
      
      // From responses
      if (inquiry.responses && inquiry.responses.length > 0) {
        inquiry.responses.forEach(response => {
          if (response.receptionistCode) {
            receptionistCodes.add(response.receptionistCode);
          }
        });
      }
    });
    
    // Get receptionist details
    const receptionists = await User.find({
      userCode: { $in: Array.from(receptionistCodes) },
      role: { $in: ['Receptionist', 'receptionist'] }
    }).select('_id name email userCode role').lean();
    
    return res.status(200).json({
      success: true,
      receptionists,
      total: receptionists.length,
      message: 'Active inquiry receptionists retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching active inquiry receptionists:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active inquiry receptionists",
      error: err.message
    });
  }
};

// GET /admin/inquiries/stats
// Get statistics for receptionist activities on inquiries
exports.getInquiryActivityStats = async (req, res) => {
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
    
    // Get inquiries in date range
    const inquiries = await InquiryModel.find({
      $or: [
        { createdAt: { $gte: startDate } },
        { updatedAt: { $gte: startDate } }
      ]
    }).lean();
    
    // Calculate statistics
    let totalInquiries = inquiries.length;
    let openInquiries = 0;
    let inProgressInquiries = 0;
    let resolvedInquiries = 0;
    let assignedInquiries = 0;
    let respondedInquiries = 0;
    
    const receptionistActivity = new Map();
    
    inquiries.forEach(inquiry => {
      // Status counts
      switch (inquiry.status) {
        case 'open':
          openInquiries++;
          break;
        case 'in_progress':
          inProgressInquiries++;
          break;
        case 'resolved':
          resolvedInquiries++;
          break;
      }
      
      // Assignment tracking
      if (inquiry.assignedTo) {
        assignedInquiries++;
        
        if (!receptionistActivity.has(inquiry.assignedTo)) {
          receptionistActivity.set(inquiry.assignedTo, { 
            assigned: 0, 
            responses: 0,
            receptionistCode: inquiry.assignedTo
          });
        }
        receptionistActivity.get(inquiry.assignedTo).assigned++;
      }
      
      // Response tracking
      if (inquiry.responses && inquiry.responses.length > 0) {
        respondedInquiries++;
        
        inquiry.responses.forEach(response => {
          if (!receptionistActivity.has(response.receptionistCode)) {
            receptionistActivity.set(response.receptionistCode, { 
              assigned: 0, 
              responses: 0,
              receptionistCode: response.receptionistCode
            });
          }
          receptionistActivity.get(response.receptionistCode).responses++;
        });
      }
    });
    
    // Get receptionist names
    const receptionistStats = [];
    for (const [code, stats] of receptionistActivity.entries()) {
      const receptionist = await User.findOne({ userCode: code }).select('name').lean();
      receptionistStats.push({
        receptionistCode: code,
        receptionistName: receptionist ? receptionist.name : `Receptionist ${code}`,
        inquiriesAssigned: stats.assigned,
        responsesGiven: stats.responses,
        totalActivity: stats.assigned + stats.responses
      });
    }
    
    return res.status(200).json({
      success: true,
      stats: {
        totalInquiries,
        openInquiries,
        inProgressInquiries,
        resolvedInquiries,
        assignedInquiries,
        respondedInquiries,
        responseRate: totalInquiries > 0 ? ((respondedInquiries / totalInquiries) * 100).toFixed(1) : 0,
        dateRange,
        startDate,
        receptionistStats
      },
      message: 'Inquiry activity statistics retrieved successfully'
    });
    
  } catch (err) {
    console.error('Error fetching inquiry activity stats:', err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch inquiry activity statistics",
      error: err.message
    });
  }
};
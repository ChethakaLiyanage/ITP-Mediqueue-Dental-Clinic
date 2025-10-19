const Inquiry = require("../Model/InquiryModel");

// ➤ Get All Inquiries for a Patient
const getMyInquiries = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const skip = (page - 1) * limit;

    const filter = { patientCode };
    
    // Optional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [inquiries, total] = await Promise.all([
      Inquiry.find(filter)
        .select("inquiryCode subject message status responses createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inquiry.countDocuments(filter)
    ]);

    return res.status(200).json({ 
      success: true,
      inquiries,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("getMyInquiries error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch inquiries" 
    });
  }
};

// ➤ Get Single Inquiry by ID (Patient can only see their own)
const getMyInquiryById = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const inquiry = await Inquiry.findOne({ 
      _id: req.params.id, 
      patientCode 
    }).lean();

    if (!inquiry) {
      return res.status(404).json({ 
        success: false,
        message: "Inquiry not found or you don't have permission to view it" 
      });
    }

    return res.status(200).json({ 
      success: true,
      inquiry 
    });
  } catch (err) {
    console.error("getMyInquiryById error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch inquiry" 
    });
  }
};

// ➤ Create New Inquiry
const createInquiry = async (req, res) => {
  try {
    console.log("Create inquiry request:", {
      body: req.body,
      user: req.user
    });

    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      console.log("No patient code found in user:", req.user);
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const { subject, message, appointmentCode, messageType = "text", metadata } = req.body;

    // Validate required fields
    if (!subject || !subject.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Subject is required" 
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Message is required" 
      });
    }

    // Create new inquiry with chat support
    const inquiry = new Inquiry({
      patientCode,
      patientName: req.user?.name || 'Patient',
      subject: subject.trim(),
      initialMessage: message.trim(),
      status: "open"
    });
    
    // Add the first message to the chat
    inquiry.addMessage("patient", patientCode, req.user?.name || 'Patient', message.trim(), messageType, appointmentCode, metadata);
    
    await inquiry.save();

    return res.status(201).json({ 
      success: true,
      message: "Inquiry created successfully",
      inquiry 
    });
  } catch (err) {
    console.error("createInquiry error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to create inquiry" 
    });
  }
};

// ➤ Update Inquiry (Patient can only update their own)
const updateMyInquiry = async (req, res) => {
  try {
    console.log("Update inquiry request:", {
      params: req.params,
      body: req.body,
      user: req.user
    });

    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      console.log("No patient code found in user:", req.user);
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const { subject, message } = req.body;
    const updateData = {};

    // Only allow updating subject and message
    if (subject !== undefined) {
      if (!subject || !subject.trim()) {
        return res.status(400).json({ 
          success: false,
          message: "Subject cannot be empty" 
        });
      }
      updateData.subject = subject.trim();
    }

    if (message !== undefined) {
      if (!message || !message.trim()) {
        return res.status(400).json({ 
          success: false,
          message: "Message cannot be empty" 
        });
      }
      updateData.message = message.trim();
    }

    // Check if inquiry exists and belongs to patient
    console.log("Looking for inquiry with ID:", req.params.id, "and patientCode:", patientCode);
    const existingInquiry = await Inquiry.findOne({ 
      _id: req.params.id, 
      patientCode 
    });

    console.log("Found existing inquiry:", existingInquiry);

    if (!existingInquiry) {
      console.log("Inquiry not found or doesn't belong to patient");
      return res.status(404).json({ 
        success: false,
        message: "Inquiry not found or you don't have permission to update it" 
      });
    }

    // Don't allow updating if inquiry is resolved
    if (existingInquiry.status === "resolved") {
      console.log("Cannot update resolved inquiry");
      return res.status(400).json({ 
        success: false,
        message: "Cannot update a resolved inquiry" 
      });
    }

    console.log("Updating inquiry with data:", updateData);
    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    ).lean();

    console.log("Updated inquiry:", inquiry);

    return res.status(200).json({ 
      success: true,
      message: "Inquiry updated successfully",
      inquiry 
    });
  } catch (err) {
    console.error("updateMyInquiry error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update inquiry" 
    });
  }
};

// ➤ Delete Inquiry (Patient can only delete their own)
const deleteMyInquiry = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    // Check if inquiry exists and belongs to patient
    const existingInquiry = await Inquiry.findOne({ 
      _id: req.params.id, 
      patientCode 
    });

    if (!existingInquiry) {
      return res.status(404).json({ 
        success: false,
        message: "Inquiry not found or you don't have permission to delete it" 
      });
    }

    // Don't allow deleting if inquiry has responses
    if (existingInquiry.responses && existingInquiry.responses.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot delete an inquiry that has responses from staff" 
      });
    }

    await Inquiry.findByIdAndDelete(req.params.id);

    return res.status(200).json({ 
      success: true,
      message: "Inquiry deleted successfully" 
    });
  } catch (err) {
    console.error("deleteMyInquiry error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to delete inquiry" 
    });
  }
};

// ➤ Get Inquiry Stats for Patient
const getMyInquiryStats = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const stats = await Inquiry.aggregate([
      { $match: { patientCode } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Inquiry.countDocuments({ patientCode });

    const statusCounts = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      total
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    return res.status(200).json({ 
      success: true,
      stats: statusCounts
    });
  } catch (err) {
    console.error("getMyInquiryStats error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch inquiry stats" 
    });
  }
};

// ➤ Get Inquiry with Chat Messages
const getInquiryWithMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;
    
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const inquiry = await Inquiry.findOne({ 
      _id: id, 
      patientCode 
    });

    if (!inquiry) {
      return res.status(404).json({ 
        success: false,
        message: "Inquiry not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      inquiry 
    });
  } catch (err) {
    console.error("getInquiryWithMessages error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch inquiry with messages" 
    });
  }
};

// ➤ Add Message to Inquiry
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const patientCode = req.user?.patientCode;
    const patientName = req.user?.name || 'Patient';
    
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Message is required" 
      });
    }

    const inquiry = await Inquiry.findOne({ 
      _id: id, 
      patientCode 
    });

    if (!inquiry) {
      return res.status(404).json({ 
        success: false,
        message: "Inquiry not found" 
      });
    }

    // Add message to chat
    const newMessage = inquiry.addMessage("patient", patientCode, patientName, message.trim());
    await inquiry.save();

    return res.status(201).json({ 
      success: true,
      message: "Message added successfully",
      newMessage 
    });
  } catch (err) {
    console.error("addMessage error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to add message" 
    });
  }
};

module.exports = {
  getMyInquiries,
  getMyInquiryById,
  createInquiry,
  updateMyInquiry,
  deleteMyInquiry,
  getMyInquiryStats,
  getInquiryWithMessages,
  addMessage
};

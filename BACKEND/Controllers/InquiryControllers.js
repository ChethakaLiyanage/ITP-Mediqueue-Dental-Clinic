const Inquiry = require("../Model/InquiryModel");

// ➤ Add Inquiry (Chat-style)
const addInquiry = async (req, res) => {
  try {
    const { patientCode, patientName, subject, message, appointmentCode, messageType = "text", metadata } = req.body;
    
    // Create new inquiry
    const inquiry = new Inquiry({
      patientCode,
      patientName,
      subject,
      initialMessage: message,
      status: "open"
    });
    
    // Add the first message to the chat
    inquiry.addMessage("patient", patientCode, patientName, message, messageType, appointmentCode, metadata);
    
    await inquiry.save();
    res.status(201).json(inquiry);
  } catch (err) {
    console.error("addInquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get All Inquiries (Paginated)
const getAllInquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const inquiries = await Inquiry.find({})
      .select("inquiryCode subject message status createdAt updatedAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Inquiry.countDocuments();
    res.status(200).json({ total, page, limit, inquiries });
  } catch (err) {
    console.error("getAllInquiries error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Inquiry by ID
const getById = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .select("inquiryCode subject message status createdAt updatedAt")
      .lean();

    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.status(200).json(inquiry);
  } catch (err) {
    console.error("getById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Inquiry by Code
const getByCode = async (req, res) => {
  try {
    const inquiry = await Inquiry.findOne({ inquiryCode: req.params.code })
      .select("inquiryCode subject message status createdAt updatedAt")
      .lean();

    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.status(200).json(inquiry);
  } catch (err) {
    console.error("getByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Update Inquiry
const updateInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).lean();

    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.status(200).json(inquiry);
  } catch (err) {
    console.error("updateInquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Delete Inquiry
const deleteInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByIdAndDelete(req.params.id).lean();
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.status(200).json({ message: "Inquiry deleted successfully" });
  } catch (err) {
    console.error("deleteInquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Add Message to Inquiry (Chat)
const addMessage = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { senderType, senderCode, senderName, message, messageType = "text", appointmentCode, metadata } = req.body;
    
    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    // Add message to chat
    const newMessage = inquiry.addMessage(senderType, senderCode, senderName, message, messageType, appointmentCode, metadata);
    await inquiry.save();
    
    res.status(201).json({ message: "Message added successfully", newMessage });
  } catch (err) {
    console.error("addMessage error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Inquiry with Chat Messages
const getInquiryWithMessages = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    
    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    // Mark messages as read if accessed by receptionist
    if (req.user.role === 'Receptionist') {
      inquiry.markAsRead(req.user.receptionistCode);
      await inquiry.save();
    }
    
    res.status(200).json(inquiry);
  } catch (err) {
    console.error("getInquiryWithMessages error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Patient's Inquiries (Chat List)
const getPatientInquiries = async (req, res) => {
  try {
    const { patientCode } = req.params;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    
    const inquiries = await Inquiry.find({ patientCode, isActive: true })
      .select("inquiryCode subject status lastMessageAt unreadCount assignedTo assignedToName")
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await Inquiry.countDocuments({ patientCode, isActive: true });
    
    res.status(200).json({ total, page, limit, inquiries });
  } catch (err) {
    console.error("getPatientInquiries error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Receptionist's Assigned Inquiries
const getReceptionistInquiries = async (req, res) => {
  try {
    const { receptionistCode } = req.params;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    
    const inquiries = await Inquiry.find({ 
      assignedTo: receptionistCode, 
      isActive: true 
    })
      .select("inquiryCode subject patientCode patientName status lastMessageAt unreadCount")
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await Inquiry.countDocuments({ assignedTo: receptionistCode, isActive: true });
    
    res.status(200).json({ total, page, limit, inquiries });
  } catch (err) {
    console.error("getReceptionistInquiries error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addInquiry = addInquiry;
exports.getAllInquiries = getAllInquiries;
exports.getById = getById;
exports.getByCode = getByCode;
exports.updateInquiry = updateInquiry;
exports.deleteInquiry = deleteInquiry;
exports.addMessage = addMessage;
exports.getInquiryWithMessages = getInquiryWithMessages;
exports.getPatientInquiries = getPatientInquiries;
exports.getReceptionistInquiries = getReceptionistInquiries;

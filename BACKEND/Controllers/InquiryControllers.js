const Inquiry = require("../Model/InquiryModel");

// ➤ Add Inquiry
const addInquiry = async (req, res) => {
  try {
    const inquiry = new Inquiry(req.body);
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

exports.addInquiry = addInquiry;
exports.getAllInquiries = getAllInquiries;
exports.getById = getById;
exports.getByCode = getByCode;
exports.updateInquiry = updateInquiry;
exports.deleteInquiry = deleteInquiry;

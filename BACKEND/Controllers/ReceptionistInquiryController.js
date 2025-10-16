// Controllers/ReceptionistInquiryController.js
const Inquiry = require("../Model/InquiryModel");
const Receptionist = require("../Model/ReceptionistModel"); // for fallback lookup

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /receptionist/inquiries
exports.listForReceptionist = async (req, res) => {
  try {
    const { status, patientCode, assignedTo, q, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (patientCode) filter.patientCode = patientCode;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (q) {
      filter.$or = [
        { subject: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Inquiry.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      Inquiry.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("listForReceptionist error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /receptionist/inquiries/:code
exports.getOneForReceptionist = async (req, res) => {
  try {
    const { code } = req.params;
    const inquiry = await Inquiry.findOne({ inquiryCode: code }).lean();
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    return res.status(200).json({ inquiry });
  } catch (err) {
    console.error("getOneForReceptionist error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /receptionist/inquiries/subject?subject=...&mode=contains|exact|prefix
exports.listBySubject = async (req, res) => {
  try {
    const { subject, mode = "contains", page = 1, limit = 10, sort = "-createdAt" } = req.query;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "subject is required" });
    }

    const safe = escapeRegex(subject.trim());
    let pattern;
    if (mode === "exact") pattern = new RegExp(`^${safe}$`, "i");
    else if (mode === "prefix") pattern = new RegExp(`^${safe}`, "i");
    else pattern = new RegExp(safe, "i");

    const filter = { subject: pattern };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Inquiry.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      Inquiry.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("listBySubject error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /receptionist/inquiries/:code/reply
// Appends a reply; records which receptionist replied (R-####).
exports.replyAsReceptionist = async (req, res) => {
  try {
    const { code } = req.params;
    const { text, assignToMe } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "text is required" });

    // 1) try req.user, 2) try DB via userId, 3) fallback to body.receptionistCode
    let receptionistCode = req.user?.receptionistCode || req.user?.code || null;

    if (!receptionistCode && req.user?._id) {
      const rc = await Receptionist.findOne({ userId: req.user._id }, "receptionistCode").lean();
      receptionistCode = rc?.receptionistCode || null;
    }

    if (!receptionistCode && req.body.receptionistCode) {
      receptionistCode = req.body.receptionistCode;
    }

    if (!receptionistCode) {
      return res.status(400).json({ message: "Unable to resolve receptionistCode from login/session." });
    }

    const current = await Inquiry.findOne({ inquiryCode: code }).lean();
    if (!current) return res.status(404).json({ message: "Inquiry not found" });

    const update = {
      $push: { responses: { receptionistCode, text: text.trim(), at: new Date() } },
    };

    const setOps = {};
    if (current.status === "open") setOps.status = "in_progress";
    if (assignToMe) setOps.assignedTo = receptionistCode;
    if (Object.keys(setOps).length) update.$set = setOps;

    const updated = await Inquiry.findOneAndUpdate({ inquiryCode: code }, update, { new: true }).lean();
    return res.status(200).json({ message: "Response added", inquiry: updated });
  } catch (err) {
    console.error("replyAsReceptionist error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /receptionist/inquiries/:code/status - Update inquiry status
exports.updateStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body;
    
    if (!status || !["open", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const inquiry = await Inquiry.findOneAndUpdate(
      { inquiryCode: code },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!inquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    return res.status(200).json({ message: "Status updated", inquiry });
  } catch (err) {
    console.error("updateStatus error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
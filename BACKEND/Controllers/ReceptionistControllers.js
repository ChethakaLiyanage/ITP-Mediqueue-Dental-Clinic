const Receptionist = require("../Model/ReceptionistModel");

function formatReceptionist(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  const user = plain.userId && typeof plain.userId === "object" && plain.userId !== null ? plain.userId : null;

  return {
    _id: plain._id,
    receptionistCode: plain.receptionistCode || null,
    deskNo: plain.deskNo || "",
    userId: user?._id || plain.userId || null,
    user: user
      ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          contact_no: user.contact_no,
        }
      : null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
}

async function addReceptionists(req, res) {
  try {
    const receptionist = new Receptionist(req.body || {});
    await receptionist.save();
    const populated = await Receptionist.findById(receptionist._id)
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    return res.status(201).json({ receptionist: formatReceptionist(populated) });
  } catch (err) {
    console.error("addReceptionists error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getAllReceptionists(req, res) {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const receptionists = await Receptionist.find({})
      .select("receptionistCode deskNo userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Receptionist.countDocuments();
    return res.status(200).json({
      total,
      page,
      limit,
      receptionists: receptionists.map(formatReceptionist),
    });
  } catch (err) {
    console.error("getAllReceptionists error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getById(req, res) {
  try {
    const receptionist = await Receptionist.findById(req.params.id)
      .select("receptionistCode deskNo userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!receptionist) {
      return res.status(404).json({ message: "Receptionist not found" });
    }

    return res.status(200).json({ receptionist: formatReceptionist(receptionist) });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getByCode(req, res) {
  try {
    const receptionist = await Receptionist.findOne({ receptionistCode: req.params.code })
      .select("receptionistCode deskNo userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!receptionist) {
      return res.status(404).json({ message: "Receptionist not found" });
    }

    return res.status(200).json({ receptionist: formatReceptionist(receptionist) });
  } catch (err) {
    console.error("getByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateReceptionist(req, res) {
  try {
    const receptionist = await Receptionist.findByIdAndUpdate(req.params.id, req.body || {}, {
      new: true,
    })
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!receptionist) {
      return res.status(404).json({ message: "Receptionist not found" });
    }

    return res.status(200).json({ receptionist: formatReceptionist(receptionist) });
  } catch (err) {
    console.error("updateReceptionist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteReceptionist(req, res) {
  try {
    const receptionist = await Receptionist.findByIdAndDelete(req.params.id).lean();
    if (!receptionist) {
      return res.status(404).json({ message: "Receptionist not found" });
    }
    return res.status(200).json({ message: "Receptionist deleted successfully" });
  } catch (err) {
    console.error("deleteReceptionist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getAllReceptionists,
  addReceptionists,
  getById,
  getByCode,
  updateReceptionist,
  deleteReceptionist,
};

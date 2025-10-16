const Manager = require("../Model/ManagerModel");

// Create Manager
const createManager = async (req, res) => {
  try {
    const manager = new Manager(req.body);
    await manager.save();
    return res.status(201).json(manager);
  } catch (err) {
    console.error("createManager error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const managerPopulate = { path: "userId", select: "name email role contact_no" };
const managerSelect = "managerCode userId department createdAt updatedAt";

// Get All Managers (Paginated)
const getAllManagers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const managers = await Manager.find({})
      .select(managerSelect)
      .populate(managerPopulate)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Manager.countDocuments();
    return res.status(200).json({ total, page, limit, managers });
  } catch (err) {
    console.error("getAllManagers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Manager by Mongo ID
const getManagerById = async (req, res) => {
  try {
    const manager = await Manager.findById(req.params.id)
      .select(managerSelect)
      .populate(managerPopulate)
      .lean();

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    return res.status(200).json(manager);
  } catch (err) {
    console.error("getManagerById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Manager by Code
const getManagerByCode = async (req, res) => {
  try {
    const manager = await Manager.findOne({ managerCode: req.params.managerCode })
      .select(managerSelect)
      .populate(managerPopulate)
      .lean();

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const { userId: userDoc = null, ...rest } = manager;
    const response = {
      manager: {
        ...rest,
        userId: userDoc ? userDoc._id : null,
      },
    };

    if (userDoc) {
      response.user = userDoc;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("getManagerByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createManager,
  getAllManagers,
  getManagerById,
  getManagerByCode,
};

const Queue = require("../Model/QueueModel");
const QueueHistory = require("../Model/QueueHistoryModel");

// 🔹 Add to Queue
const addQueue = async (req, res) => {
  try {
    const { appointmentCode, patientCode, dentist_code, reason } = req.body;

    if (!appointmentCode || !patientCode || !dentist_code) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get the highest position number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastQueue = await Queue.findOne({ date: { $gte: today } })
      .sort({ position: -1 })
      .limit(1);
    
    const nextPosition = lastQueue ? lastQueue.position + 1 : 1;

    const newQueue = new Queue({
      appointmentCode,
      patientCode,
      dentist_code,
      position: nextPosition,
      status: 'waiting',
      date: new Date(),
      reason: reason || 'General consultation'
    });

    await newQueue.save();
    
    return res.status(201).json({ 
      message: "Added to queue successfully",
      queue: newQueue 
    });
  } catch (err) {
    console.error("addQueue error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Today's Queue (paginated)
const getTodayQueue = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queues = await Queue.find({ date: { $gte: today } })
      .sort({ position: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("appointmentCode patientCode dentist_code position status updatedAt")
      .lean();

    const total = await Queue.countDocuments({ date: { $gte: today } });

    return res.status(200).json({
      queues,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getTodayQueue error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Ongoing Queue (paginated)
const getOngoing = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const queues = await Queue.find({ status: "in_treatment" })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("appointmentCode patientCode dentist_code position status updatedAt")
      .lean();

    const total = await Queue.countDocuments({ status: "in_treatment" });

    return res.status(200).json({
      queues,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getOngoing error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Next in Queue
const getNext = async (req, res) => {
  try {
    const { dentist_code } = req.params;
    const next = await Queue.findOne({ dentist_code, status: "waiting" })
      .sort({ position: 1 })
      .select("appointmentCode patientCode dentist_code position status updatedAt")
      .lean();
    return res.status(200).json({ next });
  } catch (err) {
    console.error("getNext error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Update Queue
const updateQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const queue = await Queue.findById(id);
    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    await QueueHistory.create({
      queueId: queue._id,
      dentist_code: queue.dentist_code,
      status: queue.status,
      updatedAt: queue.updatedAt,
    });

    queue.status = req.body.status || "time_switched";
    await queue.save();

    return res.status(200).json({ queue });
  } catch (err) {
    console.error("updateQueue error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Delete Queue
const deleteAndUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const queue = await Queue.findById(id);
    if (!queue) {
      return res.status(404).json({ message: "Queue not found" });
    }

    await QueueHistory.create({
      queueId: queue._id,
      dentist_code: queue.dentist_code,
      status: "deleted",
      updatedAt: new Date(),
    });

    await queue.deleteOne();
    return res.status(200).json({ message: "Queue deleted and archived" });
  } catch (err) {
    console.error("deleteAndUpdate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Get Queue Status for Patient
const getQueueStatus = async (req, res) => {
  try {
    const { patientCode } = req.params;
    
    if (!patientCode) {
      return res.status(400).json({ message: "patientCode is required" });
    }

    // Find the most recent queue entry for this patient
    const queue = await Queue.findOne({ patientCode })
      .sort({ createdAt: -1 })
      .select("status patientCode queueCode dentistCode date")
      .lean();

    if (!queue) {
      return res.status(404).json({ message: "No queue entry found for this patient" });
    }

    return res.status(200).json({ 
      status: queue.status,
      patientCode: queue.patientCode,
      queueCode: queue.queueCode,
      dentistCode: queue.dentistCode,
      date: queue.date
    });
  } catch (err) {
    console.error("getQueueStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addQueue,
  getTodayQueue,
  getOngoing,
  getNext,
  updateQueue,
  deleteAndUpdate,
  getQueueStatus,
};

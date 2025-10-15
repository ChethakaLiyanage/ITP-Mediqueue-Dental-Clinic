const Patient = require("../Model/PatientModel");

// 🔹 Get all patients (paginated)
const getAllPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const patients = await Patient.find({})
      .skip((page - 1) * limit)
      .limit(limit)
      .select("patientCode userId nic dob gender address allergies createdAt updatedAt")
      .lean();

    const total = await Patient.countDocuments();

    return res.status(200).json({
      patients,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getAllPatients error:", err);
    return res.status(500).json({ message: "Failed to load patients" });
  }
};

// 🔹 Add new patient
const addPatients = async (req, res) => {
  try {
    const { userId, nic, dob, gender, address, allergies } = req.body;
    const patient = new Patient({ userId, nic, dob, gender, address, allergies });
    await patient.save();
    return res.status(201).json({ patient });
  } catch (err) {
    console.error("addPatients error:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Duplicate key", detail: err.keyValue });
    }
    return res.status(422).json({ message: err.message || "Unable to add patient" });
  }
};

// 🔹 Get patient by ID or Code
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    let patient;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      patient = await Patient.findById(id).lean();
    } else {
      patient = await Patient.findOne({ patientCode: id }).lean();
    }

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json({ patient });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Get patient by code
const getByCode = async (req, res) => {
  try {
    const { patientCode } = req.params;
    if (!patientCode) {
      return res.status(400).json({ message: 'Patient code is required' });
    }

    const patient = await Patient.findOne({ patientCode })
      .select('-__v -password')
      .lean();

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.status(200).json({ patient });
  } catch (error) {
    console.error('Error getting patient by code:', error);
    return res.status(500).json({ 
      message: 'Error getting patient by code', 
      error: error.message 
    });
  }
};

// 🔹 Get total count of patients
const getPatientsCount = async (req, res) => {
  try {
    const count = await Patient.countDocuments();
    return res.status(200).json({ count });
  } catch (error) {
    console.error('Error getting patient count:', error);
    return res.status(500).json({ 
      message: 'Failed to get patient count',
      error: error.message 
    });
  }
};

// 🔹 Get patient by user ID
const getByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const patient = await Patient.findOne({ userId })
      .populate('userId', 'name email contact_no role')
      .lean();

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found for this user' });
    }

    return res.status(200).json({ patient });
  } catch (err) {
    console.error('getByUserId error:', err);
    return res.status(500).json({ 
      message: 'Failed to fetch patient data',
      error: err.message 
    });
  }
};

module.exports = {
  getAllPatients,
  addPatients,
  getById,
  getByCode,
  getPatientsCount,
  getByUserId,
};

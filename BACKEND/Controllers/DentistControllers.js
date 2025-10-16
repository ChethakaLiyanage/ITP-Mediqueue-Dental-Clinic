const Dentist = require("../Model/DentistModel");

// Helper function to process availability format
function processAvailabilityFormat(availability) {
  if (!availability || typeof availability !== 'object') {
    return availability;
  }

  console.log('Processing availability format:', availability);

  // Check if it's in the frontend format (with 'available' property)
  const firstKey = Object.keys(availability)[0];
  const firstValue = availability[firstKey];
  
  if (firstValue && typeof firstValue === 'object' && 'available' in firstValue) {
    // Convert frontend format to backend format (for admin creation)
    // Frontend format: { monday: { start: '09:00', end: '17:00', available: true }, ... }
    // Backend format: { Mon: '09:00-17:00', Tue: '09:00-17:00', ... }
    const processedAvailability = {};
    
    const dayMapping = {
      'monday': 'Mon',
      'tuesday': 'Tue',
      'wednesday': 'Wed',
      'thursday': 'Thu',
      'friday': 'Fri',
      'saturday': 'Sat',
      'sunday': 'Sun'
    };
    
    Object.entries(availability).forEach(([day, schedule]) => {
      // Only include days where available is true
      if (schedule.available === true && schedule.start && schedule.end) {
        const abbrevDay = dayMapping[day.toLowerCase()];
        if (abbrevDay) {
          processedAvailability[abbrevDay] = `${schedule.start}-${schedule.end}`;
        }
      }
    });
    
    console.log('Converted from frontend format:', processedAvailability);
    return Object.keys(processedAvailability).length > 0 ? processedAvailability : null;
  }
  
  // Handle array format (from dentist profile edit)
  // { Mon: ["09:00-17:00", "14:00-16:00"], Tue: ["09:00-17:00"] }
  // Convert arrays to comma-separated strings or keep single string
  const processedAvailability = {};
  let hasData = false;
  
  Object.entries(availability).forEach(([day, value]) => {
    if (Array.isArray(value)) {
      // Filter out empty strings and join with comma
      const filtered = value.filter(v => v && String(v).trim());
      if (filtered.length > 0) {
        processedAvailability[day] = filtered.length === 1 ? filtered[0] : filtered.join(', ');
        hasData = true;
      }
    } else if (value && String(value).trim()) {
      // It's already a string
      processedAvailability[day] = String(value).trim();
      hasData = true;
    }
  });
  
  console.log('Processed availability (array/string format):', processedAvailability);
  return hasData ? processedAvailability : null;
}

// ➤ Add Dentist
const addDentist = async (req, res) => {
  try {
    const dentist = new Dentist(req.body);
    await dentist.save();
    res.status(201).json(dentist);
  } catch (err) {
    console.error("addDentist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get All Dentists (Paginated)
const getAllDentists = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const dentists = await Dentist.find({})
      .select("dentistCode userId availability_schedule license_no specialization photo createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Dentist.countDocuments();
    res.status(200).json({ total, page, limit, dentists });
  } catch (err) {
    console.error("getAllDentists error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Dentist by Mongo ID
const getById = async (req, res) => {
  try {
    const dentist = await Dentist.findById(req.params.id)
      .select("dentistCode userId availability_schedule license_no specialization photo createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!dentist) return res.status(404).json({ message: "Dentist not found" });
    res.status(200).json(dentist);
  } catch (err) {
    console.error("getById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Dentist by dentistCode
const getByCode = async (req, res) => {
  try {
    const dentist = await Dentist.findOne({ dentistCode: req.params.code })
      .select("dentistCode userId availability_schedule license_no specialization photo createdAt updatedAt")
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!dentist) return res.status(404).json({ message: "Dentist not found" });
    res.status(200).json(dentist);
  } catch (err) {
    console.error("getByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Update Dentist
const updateDentist = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Process availability_schedule if present
    if (updateData.availability_schedule) {
      const processedAvailability = processAvailabilityFormat(updateData.availability_schedule);
      updateData.availability_schedule = processedAvailability;
    }
    
    const dentist = await Dentist.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).lean();

    if (!dentist) return res.status(404).json({ message: "Dentist not found" });
    res.status(200).json(dentist);
  } catch (err) {
    console.error("updateDentist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Update Dentist by dentistCode
const updateDentistByCode = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Process availability_schedule if present
    if (updateData.availability_schedule) {
      const processedAvailability = processAvailabilityFormat(updateData.availability_schedule);
      updateData.availability_schedule = processedAvailability;
    }
    
    const dentist = await Dentist.findOneAndUpdate(
      { dentistCode: req.params.code }, 
      updateData, 
      { new: true }
    ).lean();

    if (!dentist) return res.status(404).json({ message: "Dentist not found" });
    res.status(200).json(dentist);
  } catch (err) {
    console.error("updateDentistByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Delete Dentist
const deleteDentist = async (req, res) => {
  try {
    const dentist = await Dentist.findByIdAndDelete(req.params.id).lean();
    if (!dentist) return res.status(404).json({ message: "Dentist not found" });
    res.status(200).json({ message: "Dentist deleted successfully" });
  } catch (err) {
    console.error("deleteDentist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addDentist = addDentist;
exports.getAllDentists = getAllDentists;
exports.getById = getById;
exports.getByCode = getByCode;
exports.updateDentist = updateDentist;
exports.updateDentistByCode = updateDentistByCode;
exports.deleteDentist = deleteDentist;

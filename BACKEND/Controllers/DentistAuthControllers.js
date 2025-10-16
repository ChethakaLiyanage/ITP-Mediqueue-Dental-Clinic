// Controllers/AuthControllers.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Model/User");
const Manager = require("../Model/ManagerModel");
const Dentist = require("../Model/DentistModel");
const Patient = require("../Model/PatientModel");
const Receptionist = require("../Model/ReceptionistModel");

function signToken(user) {
  const payload = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "Dentist",
    ...(user.dentistCode ? { dentistCode: user.dentistCode } : {}),
    ...(user.adminCode ? { adminCode: user.adminCode } : {}),
    ...(user.patientCode ? { patientCode: user.patientCode } : {}),
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });
}

// simple helpers for validation and redirect
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getDashboardPath(role) {
  switch (role) {
    case "Dentist":
      return "/dentist/dashboard";
    case "Patient":
      return "/";
    case "Receptionist":
      return "/receptionistDashboard";
    case "Manager":
      return "/managerDashboard";
    case "Admin":
      return "/admin/dashboard";
    default:
      return "/"; // fallback
  }
}

exports.login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    // field presence
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // basic format validations
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // include +password in case schema has select:false
    const user = await User.findOne({ email }).select("+password +role +isActive");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is disabled. Contact admin." });
    }

    // Compare with bcrypt hash; if legacy plaintext is found, migrate to hash
    let ok = false;
    const stored = String(user.password || "");
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      ok = await bcrypt.compare(password, stored);
    } else {
      ok = stored === password; // legacy plaintext
      if (ok) {
        try {
          user.password = await bcrypt.hash(password, 10);
          await user.save();
        } catch (_) {
          // non-fatal; continue
        }
      }
    }

    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Attach role-specific data
    try {
      if (user.role === "Dentist") {
        const rec = await Dentist.findOne({ userId: user._id }).lean();
        if (rec?.dentistCode) {
          user.dentistCode = rec.dentistCode;
        }
      } else if (user.role === "Manager") {
        const rec = await Manager.findOne({ userId: user._id }).lean();
        if (rec) {
          user.managerCode = rec.managerCode;
          user.department = rec.department;
        }
      } else if (user.role === "Admin") {
        const Admin = require("../Model/AdminModel");
        const rec = await Admin.findOne({ userId: user._id }).lean();
        if (rec?.adminCode) {
          user.adminCode = rec.adminCode;
        }
      } else if (user.role === "Patient" || !user.role) {
        const rec = await Patient.findOne({ userId: user._id }).lean();
        if (rec) {
          user.role = "Patient";
          user.patientCode = rec.patientCode;
        }
      }
    } catch (err) {
      console.error('Error fetching role-specific data:', err);
      return res.status(500).json({ message: "Error processing your request" });
    }
    const token = signToken(user);

    // Prepare patient data if user is a patient
    let patientData = null;
    if (user.role === "Patient") {
      try {
        patientData = await Patient.findOne({ userId: user._id })
          .select('-__v -createdAt -updatedAt')
          .lean();
      } catch (err) {
        console.error('Error fetching patient data:', err);
      }
    }

    // prepare safe user object with role-specific fields
    const publicUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      contact_no: user.contact_no,
      isActive: user.isActive,
      ...(user.role === "Dentist" && { dentistCode: user.dentistCode }),
      ...(user.role === "Admin" && { adminCode: user.adminCode }),
      ...(user.role === "Manager" && {
        managerCode: user.managerCode,
        department: user.department
      }),
      ...(user.role === "Patient" && { 
        patientCode: user.patientCode,
        patientData: patientData
      }),
    };

    // Prepare response object with common fields
    const response = {
      status: "success",
      message: "Login successful",
      token,
      user: publicUser,
      role: user.role,
      // Include role-specific fields at root level for backward compatibility
      ...(user.role === "Dentist" && { dentistCode: user.dentistCode }),
      ...(user.role === "Admin" && { adminCode: user.adminCode }),
      ...(user.role === "Manager" && {
        managerCode: user.managerCode,
        department: user.department
      }),
      ...(user.role === "Patient" && { 
        patientCode: user.patientCode,
        patient: patientData
      }),
      redirectTo: getDashboardPath(user.role),
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
};

// Optional JWT verification middleware to protect routes
exports.verifyToken = (req, res, next) => {
  try {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: "Missing authorization token" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = decoded; // {_id, name, email, role}
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};



exports.me = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = userDoc.role || req.user?.role || "Patient";
    const baseUser = {
      _id: userDoc._id,
      name: userDoc.name,
      email: userDoc.email,
      role,
      phone: userDoc.contact_no || "",
      contact_no: userDoc.contact_no || "",
      gender: userDoc.gender || "",
      address: userDoc.address || "",
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
    };

    let patient = null;
    let dentist = null;
    let manager = null;
    let receptionist = null;

    if (role === "Dentist") {
      dentist = await Dentist.findOne({ userId: userDoc._id }).lean();
      if (dentist?.dentistCode) {
        baseUser.dentistCode = dentist.dentistCode;
      }
    }

    if (role === "Manager") {
      manager = await Manager.findOne({ userId: userDoc._id }).lean();
      if (manager) {
        baseUser.managerCode = manager.managerCode;
        baseUser.department = manager.department;
      }
    }

    if (role === "Admin") {
      const Admin = require("../Model/AdminModel");
      const admin = await Admin.findOne({ userId: userDoc._id }).lean();
      if (admin?.adminCode) {
        baseUser.adminCode = admin.adminCode;
      }
    }

    if (role === "Receptionist") {
      receptionist = await Receptionist.findOne({ userId: userDoc._id }).lean();
      if (receptionist?.receptionistCode) {
        baseUser.receptionistCode = receptionist.receptionistCode;
      }
    }

    if (role === "Patient") {
      patient = await Patient.findOne({ userId: userDoc._id }).lean();
      if (patient?.patientCode) {
        baseUser.patientCode = patient.patientCode;
      }
    }

    if (req.user?.patientCode && !baseUser.patientCode) {
      baseUser.patientCode = req.user.patientCode;
    }
    if (req.user?.dentistCode && !baseUser.dentistCode) {
      baseUser.dentistCode = req.user.dentistCode;
    }
    if (req.user?.managerCode && !baseUser.managerCode) {
      baseUser.managerCode = req.user.managerCode;
    }
    if (req.user?.adminCode && !baseUser.adminCode) {
      baseUser.adminCode = req.user.adminCode;
    }
    if (req.user?.receptionistCode && !baseUser.receptionistCode) {
      baseUser.receptionistCode = req.user.receptionistCode;
    }

    const payload = { user: baseUser };
    if (patient) payload.patient = patient;
    if (dentist) payload.dentist = dentist;
    if (manager) payload.manager = manager;
    if (receptionist) payload.receptionist = receptionist;

    return res.json(payload);
  } catch (err) {
    console.error("auth.me error:", err);
    return res.status(500).json({ message: "Failed to load profile" });
  }
};

// ===== Optional: keep your existing register, or use this minimal example =====
// If your current register works, you can delete this and keep your original.
const crypto = require("crypto");

exports.registerDentistWithPhoto = async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      password = "",
      contact_no = "",
      license_no = "",
      specialization = "",
      availability_schedule = null,
    } = req.body || {};

    if (!name || !email || !password || !license_no) {
      return res
        .status(400)
        .json({ message: "name, email, password, license_no are required." });
    }

    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      password: hash,
      contact_no,
      role: "Dentist",
      isActive: true,
    });

    let photo;
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      photo = {
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `${baseUrl}/uploads/dentists/${req.file.filename}`,
      };
    }

    // Process availability_schedule to convert frontend format to backend format
    let processedAvailability = availability_schedule;
    if (availability_schedule) {
      try {
        const rawAvailability = typeof availability_schedule === "string" 
          ? JSON.parse(availability_schedule) 
          : availability_schedule;
        
        // Check if it's in the frontend format (with 'available' property)
        const firstKey = Object.keys(rawAvailability)[0];
        const firstValue = rawAvailability[firstKey];
        
        if (firstValue && typeof firstValue === 'object' && 'available' in firstValue) {
          // Convert frontend format to backend format and filter only available days
          // Frontend format: { monday: { start: '09:00', end: '17:00', available: true }, ... }
          // Backend format: { Mon: '09:00-17:00', Tue: '09:00-17:00', ... }
          processedAvailability = {};
          
          const dayMapping = {
            'monday': 'Mon',
            'tuesday': 'Tue',
            'wednesday': 'Wed',
            'thursday': 'Thu',
            'friday': 'Fri',
            'saturday': 'Sat',
            'sunday': 'Sun'
          };
          
          Object.entries(rawAvailability).forEach(([day, schedule]) => {
            // Only include days where available is true
            if (schedule.available === true && schedule.start && schedule.end) {
              const abbrevDay = dayMapping[day.toLowerCase()];
              if (abbrevDay) {
                processedAvailability[abbrevDay] = `${schedule.start}-${schedule.end}`;
              }
            }
          });
          
          // If no days are available, set to null
          if (Object.keys(processedAvailability).length === 0) {
            processedAvailability = null;
          }
        } else {
          // Already in correct format (Mon: "09:00-17:00")
          processedAvailability = rawAvailability;
        }
      } catch (err) {
        console.error('Error processing availability_schedule:', err);
        processedAvailability = null;
      }
    }

    const dentist = await Dentist.create({
      userId: user._id,
      license_no,
      specialization,
      availability_schedule: processedAvailability,
      photo,
    });

    const token = signToken(user);
    const u = user.toObject();
    delete u.password;

    return res.status(201).json({
      message: "Dentist registered successfully",
      token,
      user: u,
      dentist,
    });
  } catch (err) {
    console.error("registerDentistWithPhoto error:", err);
    return res.status(500).json({ message: "Register failed", error: err.message });
  }
};

// Register a Patient: combines User + PatientModel
exports.registerPatient = async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      password = "",
      contact_no = "",
      nic = "",
      dob = "",
      gender = "",
      address = "",
      allergies = "",
    } = req.body || {};

    if (!name || !email || !password || !nic || !dob || !gender) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered." });

    const nicExists = await Patient.findOne({ nic: nic.trim() });
    if (nicExists) return res.status(409).json({ message: "NIC already registered." });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      password: hash,
      contact_no,
      role: "Patient",
      isActive: true,
    });

    const patient = await Patient.create({
      userId: user._id,
      nic: nic.trim(),
      dob: new Date(dob),
      gender,
      address,
      allergies,
    });

    const token = signToken(user);
    const u = user.toObject();
    delete u.password;

    return res.status(201).json({
      status: "ok",
      message: "Patient registered successfully",
      token,
      user: u,
      patient,
      redirectTo: "/",
    });
  } catch (err) {
    console.error("registerPatient error:", err);
    return res.status(500).json({ status: "error", message: "Register failed", error: err.message });
  }
};

// Forgot password: create token and expiry
exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !isValidEmail(email)) return res.status(400).json({ message: "Valid email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ status: "ok", message: "If the email exists, reset instructions sent." });

    const token = crypto.randomBytes(24).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // In dev, return token so you can test without email service
    return res.status(200).json({ status: "ok", message: "Reset link generated", token });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ status: "error", message: "Unable to process request" });
  }
};

// Reset password using token
exports.resetPassword = async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: "token and password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ status: "ok", message: "Password reset successful" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ status: "error", message: "Unable to reset password" });
  }
};

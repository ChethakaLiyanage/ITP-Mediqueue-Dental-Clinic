const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../Model/User");
const Patient = require("../Model/PatientModel");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{9,15}$/;
const GENDERS = new Set(["male", "female", "other", "Male", "Female", "Other"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value) {
  const normalized = normalizeString(value);
  return normalized === "" ? undefined : normalized;
}

function parseISODate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildPublicUser(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj.password;
  return obj;
}

function getJwtSecret() {
  const raw = (process.env.JWT_SECRET || "dev_secret").replace(/\r/g, "");
  const secret = raw.trim();
  if (!secret) throw new Error("JWT secret is not configured");
  return secret;
}

async function register(req, res) {
  const body = req.body || {};

  const name = normalizeString(body.name);
  const email = normalizeString(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const phone = optionalString(body.phone);
  const address = normalizeString(body.address);
  const nic = normalizeString(body.nic).toUpperCase();
  const dob = parseISODate(body.dob);
  // Capitalize first letter for gender to match PatientModel enum: Male, Female, Other
  const genderRaw = normalizeString(body.gender).toLowerCase();
  const gender = genderRaw.charAt(0).toUpperCase() + genderRaw.slice(1);
  const allergies = optionalString(body.allergies);

  const errors = [];
  if (!name) errors.push("Name is required");
  if (!EMAIL_REGEX.test(email)) errors.push("Valid email is required");
  if (!password || password.length < 6) errors.push("Password must be at least 6 characters");
  if (!nic) errors.push("NIC is required");
  if (!address) errors.push("Address is required");
  if (!dob) errors.push("Valid date of birth is required");
  if (!GENDERS.has(gender)) errors.push("Gender must be male, female or other");
  if (phone && !PHONE_REGEX.test(phone)) errors.push("Phone number must be 9-15 digits");

  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
  }

  try {
    const [existingUserByEmail, existingPatientByNic] = await Promise.all([
      User.findOne({ email }),
      Patient.findOne({ nic }),
    ]);

    if (existingUserByEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (existingPatientByNic) {
      return res.status(400).json({ message: "NIC already exists" });
    }

    const session = await mongoose.startSession();
    let userDoc;
    let patientDoc;

    try {
      session.startTransaction();

      const hashedPassword = await bcrypt.hash(password, 10);

      const [createdUser] = await User.create([
        {
          name,
          email,
          password: hashedPassword,
          phone,
          role: "Patient",
        },
      ], { session });

      const [createdPatient] = await Patient.create([
        {
          userId: createdUser._id,
          nic,
          dob,
          gender,
          address,
          phone,
          allergies,
        },
      ], { session });

      await session.commitTransaction();
      userDoc = buildPublicUser(createdUser);
      patientDoc = typeof createdPatient.toObject === "function" ? createdPatient.toObject() : createdPatient;
    } catch (innerErr) {
      await session.abortTransaction();
      throw innerErr;
    } finally {
      session.endSession();
    }

    const jwtSecret = getJwtSecret();
    const token = jwt.sign({ id: userDoc._id, role: userDoc.role }, jwtSecret, {
      expiresIn: "7d",
    });

    return res.status(201).json({ token, user: userDoc, patient: patientDoc });
  } catch (err) {
    console.error("Register error:", err);
    if (err.message === "JWT secret is not configured") {
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

async function login(req, res) {
  const email = normalizeString(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!EMAIL_REGEX.test(email) || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const jwtSecret = getJwtSecret();
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, {
      expiresIn: "7d",
    });

    const patient = await Patient.findOne({ userId: user._id }).lean();

    return res.status(200).json({ token, user: buildPublicUser(user), patient });
  } catch (err) {
    console.error("Login error:", err);
    if (err.message === "JWT secret is not configured") {
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

async function me(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const patient = await Patient.findOne({ userId }).lean();
    return res.status(200).json({ user: buildPublicUser(user), patient });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

async function updateProfile(req, res) {
  console.log('=== UPDATE PROFILE REQUEST ===');
  console.log('req.user:', req.user);
  console.log('req.body:', req.body);
  
  const userId = req.user?._id || req.user?.id;
  console.log('Extracted userId:', userId);
  
  if (!userId) {
    console.error('No userId found in request');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const body = req.body || {};
  const name = normalizeString(body.name);
  const email = normalizeString(body.email).toLowerCase();
  const dob = parseISODate(body.dob);
  // Capitalize first letter for gender to match PatientModel enum: Male, Female, Other
  const genderRaw = normalizeString(body.gender).toLowerCase();
  const gender = genderRaw.charAt(0).toUpperCase() + genderRaw.slice(1);
  const address = normalizeString(body.address);
  const allergies = optionalString(body.allergies);
  const phone = optionalString(body.phone);
  
  console.log('Parsed data:', { name, email, dob, gender, address, phone });

  const errors = [];
  if (!name) errors.push("Name is required");
  if (!EMAIL_REGEX.test(email)) errors.push("Valid email is required");
  if (!dob) errors.push("Valid date of birth is required");
  if (dob && dob > new Date()) errors.push("Date of birth cannot be in the future");
  if (!GENDERS.has(gender)) errors.push("Gender must be male, female or other");
  if (!address) errors.push("Address is required");
  if (phone && !PHONE_REGEX.test(phone)) errors.push("Phone number must be 9-15 digits");

  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const patient = await Patient.findOne({ userId });
    if (!patient) {
      return res.status(404).json({ message: "Patient profile not found" });
    }

    if (user.email !== email) {
      const existing = await User.findOne({ email, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      user.email = email;
    }

    user.name = name;
    user.phone = phone;
    patient.phone = phone;
    patient.dob = dob;
    patient.gender = gender;
    patient.address = address;
    patient.allergies = allergies;

    await user.save();
    await patient.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: buildPublicUser(user),
      patient: typeof patient.toObject === "function" ? patient.toObject() : patient,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

async function createManager(req, res) {
  const body = req.body || {};

  const name = normalizeString(body.name);
  const email = normalizeString(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const phone = optionalString(body.phone);

  const errors = [];
  if (!name) errors.push("Name is required");
  if (!EMAIL_REGEX.test(email)) errors.push("Valid email is required");
  if (!password || password.length < 6) errors.push("Password must be at least 6 characters");
  if (phone && !PHONE_REGEX.test(phone)) errors.push("Phone number must be 9-15 digits");

  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const manager = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: "manager",
    });

    const jwtSecret = getJwtSecret();
    const token = jwt.sign({ id: manager._id, role: manager.role }, jwtSecret, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      message: "Manager created successfully",
      token,
      user: buildPublicUser(manager)
    });
  } catch (err) {
    console.error("Create manager error:", err);
    if (err.message === "JWT secret is not configured") {
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message || "Server error" });
  }
}

module.exports = { register, login, me, updateProfile, createManager };

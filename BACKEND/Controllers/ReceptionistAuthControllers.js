const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Model/User"); // make sure path matches your project
const ReceptionistModel = require("../Model/ReceptionistModel"); // ✅ added line

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// POST /receptionist/register  (optional)
exports.registerReceptionist = async (req, res) => {
  try {
    const { name, email, password, contact_no } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password required" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hash,
      contact_no,
      role: "Receptionist",
      isActive: true,
    });

    const token = signToken(user);
    const safe = { _id: user._id, name: user.name, email: user.email, role: user.role };
    return res.status(201).json({ token, user: safe });
  } catch (err) {
    console.error("registerReceptionist:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /receptionist/login
exports.loginReceptionist = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: "Receptionist" });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.isActive === false) return res.status(403).json({ message: "User disabled" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);

    // ✅ ADDED: fetch receptionistCode from Receptionist collection
    let receptionistCode = null;
    try {
      const rec = await ReceptionistModel.findOne({ userId: user._id }).select("receptionistCode");
      receptionistCode = rec?.receptionistCode || null;
    } catch (err) {
      console.error("loginReceptionist: failed to fetch receptionistCode", err);
    }

    // 🔹 keep your original safe object, only add receptionistCode
    const safe = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      contact_no: user.contact_no,
      receptionistCode, // ✅ added field
    };

    return res.json({ token, user: safe });
  } catch (err) {
    console.error("loginReceptionist:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /receptionist/me  (requires auth)
exports.meReceptionist = async (req, res) => {
  if (!req.user || req.user.role !== "Receptionist") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const doc = await User.findById(req.user.id).select("_id name email role contact_no isActive");
  if (!doc) return res.status(404).json({ message: "User not found" });

  // ADD THIS SECTION
  let receptionistDoc = null;
  try {
    receptionistDoc = await ReceptionistModel.findOne({ userId: req.user.id }).select("deskNo receptionistCode");
  } catch (err) {
    console.error("meReceptionist: failed to fetch receptionist record", err);
  }

  const receptionistCode = receptionistDoc?.receptionistCode || null;
  const deskNo = receptionistDoc?.deskNo || "";

  const safeUser = {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    contact_no: doc.contact_no,
    isActive: doc.isActive,
    password: "********",
    receptionistCode,
  };

  return res.json({
    user: safeUser,
    receptionist: { deskNo, receptionistCode },
  });
};

// PATCH /receptionist/me
exports.updateMeReceptionist = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Receptionist") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const body = req.body || {};
    if ("password" in body || "role" in body || "isActive" in body) {
      return res.status(400).json({ message: "Not allowed" });
    }

    // VALIDATION
    if (body.contact_no && !/^\d{10}$/.test(body.contact_no)) {
      return res.status(400).json({ 
        message: "Contact number must be exactly 10 digits" 
      });
    }

    const allow = ["name", "email", "contact_no"];
    const update = {};
    for (const k of allow) {
      if (body[k] !== undefined) {
        update[k] = k === "email" ? String(body[k]).toLowerCase().trim() : body[k];
      }
    }

    if (update.email) {
      const exists = await User.findOne({
        _id: { $ne: req.user.id },
        email: update.email,
      });
      if (exists) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const updated = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    }).select("_id name email role contact_no isActive");

    const receptionistDoc = await ReceptionistModel.findOne({ userId: req.user.id }).select("deskNo receptionistCode");
    const safe = { ...updated.toObject(), password: "********", receptionistCode: receptionistDoc?.receptionistCode || null };
    return res.json({
      user: safe,
      receptionist: {
        deskNo: receptionistDoc?.deskNo || "",
        receptionistCode: receptionistDoc?.receptionistCode || null,
      },
    });
  } catch (err) {
    console.error("updateMeReceptionist:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const express = require("express");
const router = express.Router();

const {
  registerReceptionist,
  loginReceptionist,
  meReceptionist,
  updateMeReceptionist, // ✅ added
} = require("../Controllers/ReceptionistAuthControllers");

// simple JWT guard (use your existing one if you already have it)
const jwt = require("jsonwebtoken");
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const userId = p.id || p._id;
    req.user = { id: userId, role: p.role, name: p.name, email: p.email };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// OPTIONAL: expose register if you want to create receptionists via API
router.post("/register", registerReceptionist);

// login
router.post("/login", loginReceptionist);

// profile (auth required)
router.get("/me", requireAuth, meReceptionist);

// NEW: update my profile (Receptionist only, no password change)
router.patch("/me", requireAuth, updateMeReceptionist);

module.exports = router;



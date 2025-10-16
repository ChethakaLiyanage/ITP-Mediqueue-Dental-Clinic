// Routes/DentistauthRoutes.js
const express = require("express");
const auth_router = express.Router();

const {
  login,
  registerDentistWithPhoto,
  registerPatient,
  forgotPassword,
  resetPassword,
  verifyToken,
  me,
} = require("../Controllers/DentistAuthControllers");

const upload = require("../middleware/uploadDentistPhoto");

// Login
auth_router.post("/login", login);

// Get current user profile
auth_router.get("/me", verifyToken, me);

// Register dentist (with optional photo)
auth_router.post(
  "/register-dentist",
  upload.single("photo"),       // field name: "photo"
  registerDentistWithPhoto
);

// Register patient (no file upload here)
auth_router.post("/register-patient", registerPatient);

// Forgot/Reset password
auth_router.post("/forgot-password", forgotPassword);
auth_router.post("/reset-password", resetPassword);

module.exports = auth_router;

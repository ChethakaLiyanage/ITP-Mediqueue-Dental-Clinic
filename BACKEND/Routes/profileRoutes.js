const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { getProfile } = require("../Controllers/ProfileController");

// Protected route - requires valid JWT token
router.get("/me", authenticate, getProfile);

module.exports = router;

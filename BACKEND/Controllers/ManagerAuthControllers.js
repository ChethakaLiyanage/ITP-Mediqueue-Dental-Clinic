const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../Model/User");
const Manager = require("../Model/ManagerModel");

// Sign JWT token
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

// Simple email validation
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

// Get dashboard path based on role
const getDashboardPath = (role) => {
  switch (role) {
    case "Admin":
      return "/admin/dashboard";
    case "Dentist":
      return "/dentist/dashboard";
    case "Manager":
      return "/manager/dashboard";
    case "Patient":
      return "/patient/dashboard";
    default:
      return "/";
  }
};

// Manager Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        status: "error", 
        message: "Email and password are required" 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        status: "error", 
        message: "Invalid email or password" 
      });
    }

    // Check if user is a manager
    if (user.role !== "Manager") {
      return res.status(403).json({ 
        status: "error", 
        message: "Access denied. Manager account required." 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        status: "error", 
        message: "Invalid email or password" 
      });
    }

    // Get manager details including department
    const manager = await Manager.findOne({ userId: user._id }).lean();
    if (!manager) {
      return res.status(404).json({ 
        status: "error", 
        message: "Manager profile not found" 
      });
    }

    // Create token
    const token = signToken(user);

    // Prepare user object for response
    const userObj = user.toObject();
    delete userObj.password;

    // Prepare response
    const response = {
      status: "ok",
      message: "Login successful",
      token,
      user: {
        ...userObj,
        managerCode: manager.managerCode,
        department: manager.department || ""
      },
      role: "Manager",
      managerCode: manager.managerCode,
      department: manager.department || "",
      redirectTo: getDashboardPath("Manager"),
      verified: true
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("Manager login error:", err);
    return res.status(500).json({ 
      status: "error", 
      message: "Login failed. Please try again later." 
    });
  }
};

// Verify token middleware
const verifyToken = (req, res, next) => {
  try {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ 
        status: "error", 
        message: "No token provided" 
      });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      status: "error", 
      message: "Invalid or expired token" 
    });
  }
};

// Update Manager Profile
const updateProfile = async (req, res) => {
  try {
    const { email, department } = req.body;
    const userId = req.user.id; // From JWT token

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        status: "error", 
        message: "User not found" 
      });
    }

    // Update user email if provided and different
    if (email && email !== user.email) {
      // Check if email is already taken
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ 
          status: "error", 
          message: "Email already in use" 
        });
      }
      user.email = email;
      await user.save();
    }

    // Update manager details
    const manager = await Manager.findOneAndUpdate(
      { userId },
      { $set: { department } },
      { new: true, runValidators: true }
    );

    if (!manager) {
      return res.status(404).json({ 
        status: "error", 
        message: "Manager profile not found" 
      });
    }

    // Prepare updated user object for response
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      status: "ok",
      message: "Profile updated successfully",
      user: {
        ...userObj,
        managerCode: manager.managerCode,
        department: manager.department || ""
      }
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to update profile" 
    });
  }
};

module.exports = {
  login,
  verifyToken,
  updateProfile
};
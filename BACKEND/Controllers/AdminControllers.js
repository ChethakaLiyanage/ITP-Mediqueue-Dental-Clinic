const Admin = require("../Model/AdminModel");
const User = require("../Model/User");
const Dentist = require("../Model/DentistModel");
const Manager = require("../Model/ManagerModel");
const Receptionist = require("../Model/ReceptionistModel");
const bcrypt = require('bcryptjs');

// ➤ Create Admin
const createAdmin = async (req, res) => {
  try {
    const admin = new Admin(req.body);
    await admin.save();
    res.status(201).json(admin);
  } catch (err) {
    console.error("createAdmin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get All Admins (Paginated)
const getAllAdmins = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    const admins = await Admin.find({})
      .select("adminCode userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email role" })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Admin.countDocuments();
    res.status(200).json({ total, page, limit, admins });
  } catch (err) {
    console.error("getAllAdmins error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Admin by Mongo ID
const getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id)
      .select("adminCode userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email role" })
      .lean();

    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.status(200).json(admin);
  } catch (err) {
    console.error("getAdminById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ➤ Get Admin by Code
const getAdminByCode = async (req, res) => {
  try {
    const admin = await Admin.findOne({ adminCode: req.params.adminCode })
      .select("adminCode userId createdAt updatedAt")
      .populate({ path: "userId", select: "name email contact_no role isActive" })
      .lean();

    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.status(200).json({ admin });
  } catch (err) {
    console.error("getAdminByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Staff Management Functions

// Create new staff member
const createStaff = async (req, res) => {
  try {
    console.log('=== STAFF CREATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    console.log('Request file:', req.file);
    
    const { name, email, password, role, phone, contact_no, address, specialization, availability } = req.body;
    
    // Validate required fields
    console.log('Validating fields...');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Password:', password ? 'PROVIDED' : 'MISSING');
    console.log('Role:', role);
    console.log('Contact:', contact_no || phone);
    
    if (!name || !email || !password || !role) {
      console.log('Missing required fields!');
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missing: {
          name: !name,
          email: !email,
          password: !password,
          role: !role
        }
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists with email:', email);
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate role
    const allowedRoles = ['Admin', 'Manager', 'Dentist', 'Hygienist', 'Receptionist'];
    if (!allowedRoles.includes(role)) {
      console.log('Invalid role:', role);
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Parse availability for dentists
    let parsedAvailability = null;
    if (role === 'Dentist' && availability) {
      try {
        parsedAvailability = JSON.parse(availability);
      } catch (err) {
        console.error('Error parsing availability:', err);
        return res.status(400).json({ message: 'Invalid availability data format' });
      }
    }

    // Create user with staff details
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      contact_no: phone || contact_no, // Use phone if provided, otherwise contact_no
      address,
      isActive: true,
      specialization: role === 'Dentist' ? specialization : undefined,
      photo: req.file ? `/uploads/dentists/${req.file.filename}` : undefined,
      staffCode: `STF-${Date.now().toString().slice(-6)}`
    };

    // Add availability for dentists
    if (role === 'Dentist' && parsedAvailability) {
      userData.availability = parsedAvailability;
    }

    const user = new User(userData);
    await user.save();

    // Create role-specific records based on role
    let roleSpecificData = null;

    if (role === 'Dentist') {
      const { license_no } = req.body;
      
      if (!license_no) {
        // If no license number provided, delete the user and return error
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ message: 'License number is required for dentists' });
      }

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

      const dentistData = {
        userId: user._id,
        license_no,
        specialization: specialization || '',
        availability_schedule: parsedAvailability,
        photo
      };

      const dentist = new Dentist(dentistData);
      await dentist.save();
      
      // Update the user record with the dentistCode
      user.dentistCode = dentist.dentistCode;
      await user.save();
      
      roleSpecificData = { dentistCode: dentist.dentistCode };
      console.log('Dentist record created successfully:', dentist);

    } else if (role === 'Manager') {
      const { department } = req.body;

      const managerData = {
        userId: user._id,
        department: department || 'General Management'
      };

      const manager = new Manager(managerData);
      await manager.save();
      
      // Update the user record with the managerCode
      user.managerCode = manager.managerCode;
      await user.save();
      
      roleSpecificData = { managerCode: manager.managerCode };
      console.log('Manager record created successfully:', manager);

    } else if (role === 'Receptionist') {
      const { deskNo } = req.body;

      const receptionistData = {
        userId: user._id,
        deskNo: deskNo || 'Auto-Assigned'
      };

      const receptionist = new Receptionist(receptionistData);
      await receptionist.save();
      
      // Update the user record with the receptionistCode
      user.receptionistCode = receptionist.receptionistCode;
      await user.save();
      
      roleSpecificData = { receptionistCode: receptionist.receptionistCode };
      console.log('Receptionist record created successfully:', receptionist);
    }

    // Return user data without password
    const responseData = user.toObject();
    delete responseData.password;

    res.status(201).json({
      message: 'Staff member created successfully',
      user: responseData,
      ...roleSpecificData
    });
  } catch (err) {
    console.error('createStaff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const { role } = req.query;

    const query = { 
      role: { $in: ['Admin', 'Manager', 'Dentist', 'Hygienist', 'Receptionist', 'admin', 'manager', 'dentist', 'hygienist', 'receptionist'] } 
    };
    
    if (role) {
      query.role = role;
    }

    const [staff, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);
    
    res.status(200).json({
      total,
      page,
      limit,
      staff
    });
  } catch (err) {
    console.error('getAllStaff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get staff by ID
const getStaffById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      role: { $in: ['Admin', 'Manager', 'Dentist', 'Hygienist', 'Receptionist', 'admin', 'manager', 'dentist', 'hygienist', 'receptionist'] }
    }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('getStaffById error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update staff
const updateStaff = async (req, res) => {
  try {
    const { name, email, phone, contact_no, address, specialization, isActive, role } = req.body;
    
    const updateData = {
      name,
      email,
      contact_no: phone || contact_no, // Handle both field names
      address,
      isActive
    };

    // Only update specialization for dentists
    if ((role?.toLowerCase() === 'dentist' || role === 'Dentist') && specialization) {
      updateData.specialization = specialization;
    }

    // Handle photo upload if file exists
    if (req.file) {
      updateData.photo = `/uploads/dentists/${req.file.filename}`;
    }

    const user = await User.findOneAndUpdate(
      { 
        _id: req.params.id,
        role: { $in: ['Admin', 'Manager', 'Dentist', 'Hygienist', 'Receptionist', 'admin', 'manager', 'dentist', 'hygienist', 'receptionist'] }
      },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('updateStaff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete staff
const deleteStaff = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({
      _id: req.params.id,
      role: { $in: ['Admin', 'Manager', 'Dentist', 'Hygienist', 'Receptionist', 'admin', 'manager', 'dentist', 'hygienist', 'receptionist'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.status(200).json({ message: 'Staff deleted successfully' });
  } catch (err) {
    console.error('deleteStaff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  getAdminByCode,
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff
};

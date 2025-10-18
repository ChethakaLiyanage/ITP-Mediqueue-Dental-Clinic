const Supplier = require("../Model/SupplierModel");

// Create Supplier
const createSupplier = async (req, res) => {
  try {
    console.log("Creating supplier with data:", req.body);
    const supplier = new Supplier(req.body);
    console.log("Supplier object created:", supplier);
    await supplier.save();
    console.log("Supplier saved successfully");
    return res.status(201).json({
      message: "Supplier created successfully",
      supplier
    });
  } catch (err) {
    console.error("createSupplier error:", err);
    console.error("Error details:", {
      name: err.name,
      message: err.message,
      errors: err.errors
    });
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: "Supplier with this email already exists" 
      });
    }
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      console.error("Validation errors:", errors);
      return res.status(400).json({ 
        message: "Validation error", 
        errors 
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

// Get All Suppliers (Paginated)
const getAllSuppliers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const search = req.query.search || "";
    const category = req.query.category || "";
    const isActive = req.query.isActive;

    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { supplierCode: { $regex: search, $options: "i" } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Supplier.countDocuments(query);
    
    return res.status(200).json({ 
      total, 
      page, 
      limit, 
      suppliers 
    });
  } catch (err) {
    console.error("getAllSuppliers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Supplier by ID
const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json(supplier);
  } catch (err) {
    console.error("getSupplierById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Supplier by Code
const getSupplierByCode = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ supplierCode: req.params.code });
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json(supplier);
  } catch (err) {
    console.error("getSupplierByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Update Supplier
const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    return res.status(200).json({
      message: "Supplier updated successfully",
      supplier
    });
  } catch (err) {
    console.error("updateSupplier error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: "Supplier with this email already exists" 
      });
    }
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: "Validation error", 
        errors 
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

// Delete Supplier (Soft delete - set isActive to false)
const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    return res.status(200).json({
      message: "Supplier deactivated successfully",
      supplier
    });
  } catch (err) {
    console.error("deleteSupplier error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Permanently delete Supplier
const permanentDeleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    return res.status(200).json({
      message: "Supplier permanently deleted"
    });
  } catch (err) {
    console.error("permanentDeleteSupplier error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Reactivate Supplier
const reactivateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    return res.status(200).json({
      message: "Supplier reactivated successfully",
      supplier
    });
  } catch (err) {
    console.error("reactivateSupplier error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Supplier Statistics
const getSupplierStats = async (req, res) => {
  try {
    const stats = await Supplier.aggregate([
      {
        $group: {
          _id: null,
          totalSuppliers: { $sum: 1 },
          activeSuppliers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }
          },
          inactiveSuppliers: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] }
          },
          avgRating: { $avg: "$rating" },
          totalValue: { $sum: "$totalValue" }
        }
      }
    ]);

    const categoryStats = await Supplier.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return res.status(200).json({
      stats: stats[0] || {
        totalSuppliers: 0,
        activeSuppliers: 0,
        inactiveSuppliers: 0,
        avgRating: 0,
        totalValue: 0
      },
      categoryStats
    });
  } catch (err) {
    console.error("getSupplierStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Update Supplier Rating
const updateSupplierRating = async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        message: "Rating must be between 1 and 5" 
      });
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { rating },
      { new: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    return res.status(200).json({
      message: "Supplier rating updated successfully",
      supplier
    });
  } catch (err) {
    console.error("updateSupplierRating error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  getSupplierByCode,
  updateSupplier,
  deleteSupplier,
  permanentDeleteSupplier,
  reactivateSupplier,
  getSupplierStats,
  updateSupplierRating
};

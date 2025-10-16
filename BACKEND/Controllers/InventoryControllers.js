const Inventory = require("../Model/Inventory");

// Get all inventory items
exports.getAllInventory = async (req, res) => {
  try {
    const items = await Inventory.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ message: "Failed to fetch inventory items", error: error.message });
  }
};

// Get single inventory item by ID
exports.getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ message: "Failed to fetch inventory item", error: error.message });
  }
};

// Get inventory item by item code
exports.getInventoryByCode = async (req, res) => {
  try {
    const item = await Inventory.findOne({ itemCode: req.params.code });
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ message: "Failed to fetch inventory item", error: error.message });
  }
};

// Create new inventory item
exports.createInventory = async (req, res) => {
  console.log('=== CREATE INVENTORY REQUEST ===');
  console.log('Request body:', req.body); // Log the incoming request body
  console.log('Request headers:', req.headers); // Log request headers
  console.log('User from middleware:', req.user); // Log user info
  
  try {
    const { itemName, quantity, unit, category, minStockLevel, supplier } = req.body;

    // Log the extracted values
    console.log('Extracted values:', { itemName, quantity, unit, category, minStockLevel, supplier });

    // Validation
    if (!itemName || itemName.trim() === "") {
      console.log('Validation failed: Item name is required');
      return res.status(400).json({ message: "Item name is required" });
    }

    if (quantity === undefined || quantity < 0) {
      console.log('Validation failed: Invalid quantity');
      return res.status(400).json({ message: "Valid quantity is required" });
    }

    // Create new inventory item
    const newItem = new Inventory({
      itemName: itemName.trim(),
      quantity: quantity || 0,
      unit: unit || "pcs",
      category: category || "",
      minStockLevel: minStockLevel || 10,
      supplier: supplier || "",
      lastRestocked: new Date()
    });

    console.log('Attempting to save item:', newItem);
    
    try {
      const savedItem = await newItem.save();
      console.log('Item saved successfully:', savedItem);
      return res.status(201).json(savedItem);
    } catch (saveError) {
      console.error('Error saving to database:', saveError);
      if (saveError.name === 'ValidationError') {
        console.error('Validation errors:', saveError.errors);
      }
      throw saveError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error("Error in createInventory:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    res.status(500).json({ 
      message: "Failed to create inventory item", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update inventory item
exports.updateInventory = async (req, res) => {
  try {
    const { itemName, quantity, unit, category, minStockLevel, supplier } = req.body;

    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Update fields
    if (itemName !== undefined) item.itemName = itemName.trim();
    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({ message: "Quantity cannot be negative" });
      }
      item.quantity = quantity;
      item.lastRestocked = new Date();
    }
    if (unit !== undefined) item.unit = unit;
    if (category !== undefined) item.category = category;
    if (minStockLevel !== undefined) item.minStockLevel = minStockLevel;
    if (supplier !== undefined) item.supplier = supplier;

    const updatedItem = await item.save();
    res.status(200).json(updatedItem);
  } catch (error) {
    console.error("Error updating inventory item:", error);
    res.status(500).json({ message: "Failed to update inventory item", error: error.message });
  }
};

// Delete inventory item (soft delete)
exports.deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Soft delete - set isActive to false
    item.isActive = false;
    await item.save();

    res.status(200).json({ message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({ message: "Failed to delete inventory item", error: error.message });
  }
};

// Get low stock items
exports.getLowStockItems = async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      isActive: true,
      $expr: { $lte: ["$quantity", "$minStockLevel"] }
    }).sort({ quantity: 1 });

    res.status(200).json(lowStockItems);
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    res.status(500).json({ message: "Failed to fetch low stock items", error: error.message });
  }
};

const InventoryRequest = require("../Model/InventoryRequest");
const InventoryNotification = require("../Model/InventoryNotificationModel");
const Inventory = require("../Model/Inventory");

// Get all inventory requests
exports.getAllInventoryRequests = async (req, res) => {
  try {
    const requests = await InventoryRequest.find({})
      .sort({ createdAt: -1 });
    
    console.log(`Found ${requests.length} inventory requests`);
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching inventory requests:", error);
    res.status(500).json({ 
      message: "Failed to fetch inventory requests", 
      error: error.message 
    });
  }
};

// Get inventory request by ID
exports.getInventoryRequestById = async (req, res) => {
  try {
    const request = await InventoryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Inventory request not found" });
    }
    res.status(200).json(request);
  } catch (error) {
    console.error("Error fetching inventory request:", error);
    res.status(500).json({ 
      message: "Failed to fetch inventory request", 
      error: error.message 
    });
  }
};

// Create new inventory request
exports.createInventoryRequest = async (req, res) => {
  try {
    const { dentistCode, dentistName, items, notes } = req.body;

    // Validation
    if (!dentistCode || !dentistName) {
      return res.status(400).json({ message: "Dentist code and name are required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemName || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ 
          message: "Each item must have a name and valid quantity" 
        });
      }
    }

    // Create new inventory request
    const newRequest = new InventoryRequest({
      dentistCode,
      dentistName,
      items,
      notes: notes || ""
    });

    const savedRequest = await newRequest.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    console.error("Error creating inventory request:", error);
    res.status(500).json({ 
      message: "Failed to create inventory request", 
      error: error.message 
    });
  }
};

// Update inventory request status
exports.updateInventoryRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body;

    console.log('=== UPDATE INVENTORY REQUEST STATUS ===');
    console.log('Request ID:', id);
    console.log('New Status:', status);
    console.log('Approved By:', approvedBy);

    if (!['Pending', 'Approved', 'Rejected', 'Fulfilled'].includes(status)) {
      console.log('Invalid status provided:', status);
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await InventoryRequest.findById(id);
    if (!request) {
      console.log('Request not found with ID:', id);
      return res.status(404).json({ message: "Inventory request not found" });
    }

    console.log('Found request:', request.requestCode, 'Current status:', request.status);

    // Update status
    request.status = status;

    // Set approval details if approved
    if (status === 'Approved') {
      request.approvedBy = approvedBy || req.user?.name || 'Manager';
      request.approvedAt = new Date();
      
      // Update inventory quantities when request is approved
      console.log('Request approved - updating inventory quantities...');
      try {
        for (const item of request.items) {
          console.log(`Processing item: ${item.itemName} (${item.itemCode}) - Quantity: ${item.quantity}`);
          
          // Find the inventory item by itemCode
          const inventoryItem = await Inventory.findOne({ itemCode: item.itemCode });
          
          if (!inventoryItem) {
            console.warn(`Inventory item not found for itemCode: ${item.itemCode}`);
            continue;
          }
          
          // Check if there's enough quantity
          if (inventoryItem.quantity < item.quantity) {
            console.warn(`Insufficient quantity for ${item.itemName}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}`);
            return res.status(400).json({ 
              message: `Insufficient quantity for ${item.itemName}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
            });
          }
          
          // Deduct the quantity from inventory
          inventoryItem.quantity -= item.quantity;
          inventoryItem.lastRestocked = new Date();
          
          await inventoryItem.save();
          console.log(`Updated inventory for ${item.itemName}: New quantity = ${inventoryItem.quantity}`);
        }
        console.log('All inventory quantities updated successfully');
      } catch (inventoryError) {
        console.error('Error updating inventory quantities:', inventoryError);
        return res.status(500).json({ 
          message: 'Failed to update inventory quantities', 
          error: inventoryError.message 
        });
      }
    }

    // Set fulfillment date if fulfilled
    if (status === 'Fulfilled') {
      request.fulfilledAt = new Date();
    }

    console.log('Saving updated request...');
    const updatedRequest = await request.save();
    console.log('Request saved successfully:', updatedRequest.requestCode, 'New status:', updatedRequest.status);

    // Create notification for status change (only for Approved/Rejected/Fulfilled)
    if (['Approved', 'Rejected', 'Fulfilled'].includes(status)) {
      try {
        console.log('Creating notification for status change:', status);
        
        const notification = new InventoryNotification({
          requestId: id,
          dentistCode: request.dentistCode,
          items: request.items.map(item => ({
            itemName: item.itemName,
            itemCode: item.itemCode || '',
            quantity: item.quantity
          })),
          notes: request.notes || '',
          status: status,
          read: false
        });

        await notification.save();
        console.log(`Notification created successfully for request ${id} with status ${status}`);
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        console.error("Notification error details:", notificationError.message);
        // Don't fail the main request if notification creation fails
      }
    }

    res.status(200).json(updatedRequest);
  } catch (error) {
    console.error("Error updating inventory request status:", error);
    res.status(500).json({ 
      message: "Failed to update inventory request status", 
      error: error.message 
    });
  }
};

// Helper function to restore inventory quantities (if needed for rejected requests)
exports.restoreInventoryQuantities = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await InventoryRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Inventory request not found" });
    }

    if (request.status !== 'Approved') {
      return res.status(400).json({ message: "Can only restore quantities for approved requests" });
    }

    console.log('Restoring inventory quantities for request:', request.requestCode);
    
    for (const item of request.items) {
      console.log(`Restoring item: ${item.itemName} (${item.itemCode}) - Quantity: ${item.quantity}`);
      
      const inventoryItem = await Inventory.findOne({ itemCode: item.itemCode });
      if (inventoryItem) {
        inventoryItem.quantity += item.quantity;
        await inventoryItem.save();
        console.log(`Restored inventory for ${item.itemName}: New quantity = ${inventoryItem.quantity}`);
      }
    }

    res.status(200).json({ message: "Inventory quantities restored successfully" });
  } catch (error) {
    console.error("Error restoring inventory quantities:", error);
    res.status(500).json({ 
      message: "Failed to restore inventory quantities", 
      error: error.message 
    });
  }
};

// Delete inventory request (hard delete)
exports.deleteInventoryRequest = async (req, res) => {
  try {
    const request = await InventoryRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Inventory request not found" });
    }

    res.status(200).json({ message: "Inventory request deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory request:", error);
    res.status(500).json({ 
      message: "Failed to delete inventory request", 
      error: error.message 
    });
  }
};

// Get inventory requests by dentist
exports.getInventoryRequestsByDentist = async (req, res) => {
  try {
    const { dentistCode } = req.params;
    const requests = await InventoryRequest.find({ 
      dentistCode
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${requests.length} inventory requests for dentist ${dentistCode}`);
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching dentist inventory requests:", error);
    res.status(500).json({ 
      message: "Failed to fetch dentist inventory requests", 
      error: error.message 
    });
  }
};

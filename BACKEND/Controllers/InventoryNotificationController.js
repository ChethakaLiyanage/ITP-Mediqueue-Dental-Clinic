const InventoryNotification = require("../Model/InventoryNotificationModel");

// Create a new notification
const createNotification = async (req, res) => {
  try {
    const { requestId, dentistCode, items, notes, status } = req.body;

    // Validate required fields
    if (!dentistCode || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Dentist code and at least one item are required" 
      });
    }

    // Create new notification
    const notification = new InventoryNotification({
      requestId,
      dentistCode,
      items: items.map(item => ({
        itemName: item.itemName,
        itemCode: item.itemCode || '',
        quantity: item.quantity
      })),
      notes: notes || '',
      status: status || 'Pending',
      read: false
    });

    // Save to database
    const savedNotification = await notification.save();

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: savedNotification
    });

  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message
    });
  }
};

// Get all notifications
const getAllNotifications = async (req, res) => {
  try {
    const { status, read } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (read !== undefined) filter.read = read === 'true';

    const notifications = await InventoryNotification.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await InventoryNotification.findByIdAndUpdate(
      id,
      { 
        read: true,
        readAt: new Date() 
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification
    });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification status",
      error: error.message
    });
  }
};

module.exports = {
  createNotification,
  getAllNotifications,
  markAsRead
};

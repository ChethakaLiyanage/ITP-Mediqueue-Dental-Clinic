const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createNotification,
  getAllNotifications,
  markAsRead
} = require('../Controllers/InventoryNotificationController');

// Create a new notification (protected route)
router.post('/', authenticate, createNotification);

// Get all notifications (protected route)
router.get('/', authenticate, getAllNotifications);

// Mark notification as read (protected route)
router.patch('/:id/read', authenticate, markAsRead);

module.exports = router;

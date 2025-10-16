const express = require('express');
const inventory_router = express.Router();
const inventoryController = require('../Controllers/InventoryControllers');
const requireAuth = require('../middleware/requireAuth'); // Use the comprehensive auth middleware

inventory_router.get('/', requireAuth, inventoryController.getAllInventory);
inventory_router.get('/low-stock', requireAuth, inventoryController.getLowStockItems);
inventory_router.get('/:id', requireAuth, inventoryController.getInventoryById);
inventory_router.post('/', requireAuth, inventoryController.createInventory);
inventory_router.put('/:id', requireAuth, inventoryController.updateInventory);
inventory_router.delete('/:id', requireAuth, inventoryController.deleteInventory);

module.exports = inventory_router;
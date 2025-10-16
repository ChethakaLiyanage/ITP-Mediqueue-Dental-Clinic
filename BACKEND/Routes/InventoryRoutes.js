const express = require('express');
const minventory_router = express.Router();
const inventoryController = require('../Controllers/InventoryControllers');
const { authenticate } = require('../middleware/auth'); // Your auth middleware

minventory_router.get('/', authenticate, inventoryController.getAllInventory);
minventory_router.get('/low-stock', authenticate, inventoryController.getLowStockItems);
minventory_router.get('/:id', authenticate, inventoryController.getInventoryById);
minventory_router.post('/', authenticate, inventoryController.createInventory);
minventory_router.put('/:id', authenticate, inventoryController.updateInventory);
minventory_router.delete('/:id', authenticate, inventoryController.deleteInventory);

module.exports = minventory_router;
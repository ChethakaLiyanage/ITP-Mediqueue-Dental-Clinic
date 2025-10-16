// Routes/QueueRoutes.js
const express = require("express");
const queueRouter = express.Router();
const QueueCtrl = require("../Controllers/QueueController");

// ✅ Create queue entry
queueRouter.post("/", QueueCtrl.addQueue);

// ✅ Fetch queues
queueRouter.get("/today", QueueCtrl.getTodayQueue);
queueRouter.get("/ongoing", QueueCtrl.getOngoing);
queueRouter.get("/next", QueueCtrl.getNext);

// ✅ Update / delete queue entries
queueRouter.patch("/update/:id", QueueCtrl.updateQueue);
queueRouter.delete("/delete-update/:id", QueueCtrl.deleteAndUpdate);

// ✅ Get queue status for a specific patient
queueRouter.get("/status/:patientCode", QueueCtrl.getQueueStatus);

module.exports = queueRouter;

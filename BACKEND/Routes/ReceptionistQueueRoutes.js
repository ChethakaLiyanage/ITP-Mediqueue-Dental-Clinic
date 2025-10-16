const expressC = require('express');
const queueRouter = expressC.Router();
const QueueCtrl = require('../Controllers/ReceptionistQueueController');

// ---- helper: silently migrate today's appointments, then continue ----
function silentMigrate(req, res, next) {
  try {
    const fakeReq = {
      ...req,
      query: {
        ...req.query,
        // default to today if not provided
        date: req.query.date || new Date().toISOString().slice(0, 10),
      },
    };
    // swallow any response from migrateToday so we can continue to listQueue
    const fakeRes = {
      status() { return this; },
      json() { /* ignore body on purpose */ },
    };

    Promise.resolve(QueueCtrl.migrateToday(fakeReq, fakeRes))
      .finally(() => next());
  } catch (e) {
    // if anything goes wrong, just proceed to list
    next();
  }
}

// List queue (auto-migrate first so older appointments for "today" appear)
queueRouter.get('/', silentMigrate, QueueCtrl.listQueue);

// Update status for a queue item
queueRouter.patch('/:queueCode/status', QueueCtrl.updateStatus);

// Manual backfill
queueRouter.post('/migrate-today', QueueCtrl.migrateToday);


// Switch time within today (Update button)
queueRouter.patch('/:queueCode/switch-time', QueueCtrl.switchTime);

// Remove from queue & recreate appointment (Delete & Update button)
queueRouter.post('/:queueCode/delete-update', QueueCtrl.deleteAndUpdate);

// ✅ NEW: Cancel appointment (Cancel button)
queueRouter.delete('/:queueCode/cancel', QueueCtrl.cancelAppointment);

module.exports = queueRouter;
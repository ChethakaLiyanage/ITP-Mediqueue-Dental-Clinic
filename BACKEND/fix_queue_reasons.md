# Fix Queue Reasons - Database Update

The existing queue entries in the database don't have the `reason` field populated. Here's how to fix it:

## Option 1: MongoDB Compass/Shell
Run this command in MongoDB Compass or MongoDB shell:

```javascript
db.queues.updateMany(
  {
    $or: [
      { reason: { $exists: false } },
      { reason: null },
      { reason: "" },
      { reason: "-" }
    ]
  },
  {
    $set: { reason: "General consultation" }
  }
)
```

## Option 2: Using Node.js Script
Create a file called `fix-queue-reasons.js` in the BACKEND directory:

```javascript
const mongoose = require('mongoose');
const Queue = require('./Model/QueueModel');

async function fixQueueReasons() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dental-clinic');
    console.log('Connected to MongoDB');
    
    const result = await Queue.updateMany(
      {
        $or: [
          { reason: { $exists: false } },
          { reason: null },
          { reason: "" },
          { reason: "-" }
        ]
      },
      {
        $set: { reason: "General consultation" }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} queue entries`);
    
    // Verify
    const queues = await Queue.find({}).lean();
    console.log('Current queue entries:');
    queues.forEach(q => {
      console.log(`${q.queueCode}: "${q.reason}"`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixQueueReasons();
```

Then run: `node fix-queue-reasons.js`

## Option 3: Manual Database Update
If you have access to the database directly, you can manually update the queue entries to add the reason field.

After running any of these options, refresh the dentist dashboard and the reasons should appear instead of hyphens.

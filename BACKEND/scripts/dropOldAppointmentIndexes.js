require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const mongoUri = process.env.MONGO_URI;
  const dbName = 'Mediqueue_dental_clinic';
  if (!mongoUri) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoUri, { dbName });
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('appointmentmodels');
    const indexes = await collection.indexes();
    console.log('Existing indexes:', indexes.map(i => i.name));

    const oldIndexName = 'dentist_code_1_appointment_date_1';
    if (indexes.some(i => i.name === oldIndexName)) {
      await collection.dropIndex(oldIndexName);
      console.log(`Dropped index: ${oldIndexName}`);
    } else {
      console.log(`Index not found: ${oldIndexName}`);
    }

    // Optional: ensure non-unique compound index (safe)
    try {
      await collection.createIndex({ dentistCode: 1, appointmentDate: 1 }, { unique: false });
      console.log('Ensured non-unique index on { dentistCode, appointmentDate }');
    } catch (e) {
      console.warn('Could not create non-unique index (may already exist):', e.message);
    }

    await mongoose.disconnect();
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error dropping indexes:', err);
    process.exit(1);
  }
}

main();



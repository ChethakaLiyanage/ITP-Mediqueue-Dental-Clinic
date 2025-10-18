const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Appointment = require('../Model/AppointmentModel');
const Patient = require('../Model/PatientModel');
const Dentist = require('../Model/DentistModel');
const Feedback = require('../Model/FeedbackModel');
const InventoryItem = require('../Model/Inventory');
const InventoryRequest = require('../Model/InventoryRequest');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  dbName: "Mediqueue_dental_clinic",
})
.then(() => {
  console.log("Connected to MongoDB for seeding");
  seedData();
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

async function seedData() {
  try {
    console.log('Starting to seed sample data...');

    // Clear existing data (optional - remove if you want to keep existing data)
    // await Appointment.deleteMany({});
    // await Patient.deleteMany({});
    // await Dentist.deleteMany({});
    // await Feedback.deleteMany({});
    // await InventoryItem.deleteMany({});
    // await InventoryRequest.deleteMany({});

    // Create sample patients
    const patients = await Patient.find({});
    if (patients.length === 0) {
      const samplePatients = [
        {
          name: 'John Doe',
          email: 'john.doe@email.com',
          phone: '0771234567',
          address: {
            street: '123 Main St',
            city: 'Colombo',
            state: 'Western',
            zipCode: '10000',
            country: 'Sri Lanka'
          },
          dateOfBirth: new Date('1990-01-15'),
          gender: 'Male',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '0777654321',
            relationship: 'Spouse'
          }
        },
        {
          name: 'Sarah Wilson',
          email: 'sarah.wilson@email.com',
          phone: '0772345678',
          address: {
            street: '456 Oak Ave',
            city: 'Kandy',
            state: 'Central',
            zipCode: '20000',
            country: 'Sri Lanka'
          },
          dateOfBirth: new Date('1985-05-20'),
          gender: 'Female',
          emergencyContact: {
            name: 'Mike Wilson',
            phone: '0778765432',
            relationship: 'Husband'
          }
        },
        {
          name: 'Dr. Johnson',
          email: 'dr.johnson@email.com',
          phone: '0773456789',
          address: {
            street: '789 Pine St',
            city: 'Galle',
            state: 'Southern',
            zipCode: '80000',
            country: 'Sri Lanka'
          },
          dateOfBirth: new Date('1980-03-10'),
          gender: 'Male',
          emergencyContact: {
            name: 'Mrs. Johnson',
            phone: '0779876543',
            relationship: 'Wife'
          }
        }
      ];

      const createdPatients = await Patient.insertMany(samplePatients);
      console.log(`Created ${createdPatients.length} patients`);
    }

    // Create sample dentists
    const dentists = await Dentist.find({});
    if (dentists.length === 0) {
      const sampleDentists = [
        {
          name: 'Dr. Smith',
          email: 'dr.smith@clinic.com',
          phone: '0771111111',
          specialization: 'General Dentistry',
          licenseNumber: 'DENT001',
          isActive: true,
          schedule: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
          }
        },
        {
          name: 'Dr. Brown',
          email: 'dr.brown@clinic.com',
          phone: '0772222222',
          specialization: 'Orthodontics',
          licenseNumber: 'DENT002',
          isActive: true,
          schedule: {
            monday: { start: '10:00', end: '18:00' },
            tuesday: { start: '10:00', end: '18:00' },
            wednesday: { start: '10:00', end: '18:00' },
            thursday: { start: '10:00', end: '18:00' },
            friday: { start: '10:00', end: '18:00' }
          }
        }
      ];

      const createdDentists = await Dentist.insertMany(sampleDentists);
      console.log(`Created ${createdDentists.length} dentists`);
    }

    // Create sample appointments
    const appointments = await Appointment.find({});
    if (appointments.length === 0) {
      const patients = await Patient.find({});
      const dentists = await Dentist.find({});
      
      if (patients.length > 0 && dentists.length > 0) {
        const sampleAppointments = [
          {
            patient: patients[0]._id,
            dentist: dentists[0]._id,
            appointment_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            status: 'confirmed',
            appointmentType: 'Checkup',
            notes: 'Regular dental checkup',
            isActive: true
          },
          {
            patient: patients[1]._id,
            dentist: dentists[1]._id,
            appointment_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
            status: 'pending',
            appointmentType: 'Cleaning',
            notes: 'Teeth cleaning appointment',
            isActive: true
          },
          {
            patient: patients[2]._id,
            dentist: dentists[0]._id,
            appointment_date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            status: 'completed',
            appointmentType: 'Filling',
            notes: 'Cavity filling completed',
            isActive: true
          }
        ];

        const createdAppointments = await Appointment.insertMany(sampleAppointments);
        console.log(`Created ${createdAppointments.length} appointments`);
      }
    }

    // Create sample feedback
    const feedback = await Feedback.find({});
    if (feedback.length === 0) {
      const patients = await Patient.find({});
      const dentists = await Dentist.find({});
      
      if (patients.length > 0 && dentists.length > 0) {
        const sampleFeedback = [
          {
            patient: patients[0]._id,
            dentist: dentists[0]._id,
            rating: 5,
            comment: 'Excellent service! Very professional and friendly.',
            appointmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isActive: true
          },
          {
            patient: patients[1]._id,
            dentist: dentists[1]._id,
            rating: 4,
            comment: 'Good experience overall. Clean and modern facility.',
            appointmentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            isActive: true
          }
        ];

        const createdFeedback = await Feedback.insertMany(sampleFeedback);
        console.log(`Created ${createdFeedback.length} feedback entries`);
      }
    }

    // Create sample inventory items
    const inventory = await InventoryItem.find({});
    if (inventory.length === 0) {
      const sampleInventory = [
        {
          itemName: 'Dental Floss',
          quantity: 50,
          unit: 'pcs',
          category: 'Hygiene',
          supplier: 'Dental Supplies Co.',
          lowStockThreshold: 20,
          cost: 5.00,
          isActive: true
        },
        {
          itemName: 'Toothpaste',
          quantity: 10,
          unit: 'tubes',
          category: 'Hygiene',
          supplier: 'Oral Care Ltd.',
          lowStockThreshold: 15,
          cost: 8.50,
          isActive: true
        },
        {
          itemName: 'Dental Mirrors',
          quantity: 25,
          unit: 'pcs',
          category: 'Equipment',
          supplier: 'Medical Equipment Inc.',
          lowStockThreshold: 10,
          cost: 15.00,
          isActive: true
        }
      ];

      const createdInventory = await InventoryItem.insertMany(sampleInventory);
      console.log(`Created ${createdInventory.length} inventory items`);
    }

    // Create sample inventory requests
    const inventoryRequests = await InventoryRequest.find({});
    if (inventoryRequests.length === 0) {
      const dentists = await Dentist.find({});
      const inventory = await InventoryItem.find({});
      
      if (dentists.length > 0 && inventory.length > 0) {
        const sampleRequests = [
          {
            requestedBy: dentists[0]._id,
            items: [
              {
                item: inventory[0]._id,
                quantity: 10,
                reason: 'Low stock'
              }
            ],
            status: 'pending',
            requestDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            notes: 'Need more dental floss for next week'
          }
        ];

        const createdRequests = await InventoryRequest.insertMany(sampleRequests);
        console.log(`Created ${createdRequests.length} inventory requests`);
      }
    }

    console.log('Sample data seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

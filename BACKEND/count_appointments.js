const mongoose = require('mongoose');
const Appointment = require('./Model/AppointmentModel');
const Queue = require('./Model/QueueModel');

async function countAppointments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/mediqueue');
    console.log('Connected to MongoDB');
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    console.log('Checking appointments from:', startOfMonth.toISOString());
    console.log('To:', endOfMonth.toISOString());
    
    const appointmentCount = await Appointment.countDocuments({
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const queueCount = await Queue.countDocuments({
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    console.log('Appointments in AppointmentModel:', appointmentCount);
    console.log('Appointments in QueueModel:', queueCount);
    console.log('Total appointments this month:', appointmentCount + queueCount);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

countAppointments();



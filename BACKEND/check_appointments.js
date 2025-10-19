const mongoose = require('mongoose');
const Appointment = require('./Model/AppointmentModel');
const Queue = require('./Model/QueueModel');

async function checkAppointments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/mediqueue');
    console.log('Connected to MongoDB');
    
    // Get current month start and end dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    console.log('Checking appointments from:', startOfMonth.toISOString());
    console.log('To:', endOfMonth.toISOString());
    
    // Check AppointmentModel for future appointments
    const appointments = await Appointment.find({
      appointmentDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('patientCode', 'name').populate('dentistCode', 'dentistCode');
    
    console.log('\n📅 APPOINTMENTS IN APPOINTMENTMODEL:');
    console.log('Count:', appointments.length);
    appointments.forEach(apt => {
      console.log(`- ${apt.appointmentCode}: ${apt.appointmentDate.toISOString().split('T')[0]} (${apt.patientCode?.name || 'Unknown'})`);
    });
    
    // Check QueueModel for today's appointments
    const queueAppointments = await Queue.find({
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('patientCode', 'name');
    
    console.log('\n🏥 APPOINTMENTS IN QUEUEMODEL:');
    console.log('Count:', queueAppointments.length);
    queueAppointments.forEach(q => {
      console.log(`- ${q.appointmentCode}: ${q.date.toISOString().split('T')[0]} (${q.patientName || q.patientCode?.name || 'Unknown'})`);
    });
    
    const totalAppointments = appointments.length + queueAppointments.length;
    console.log('\n📊 TOTAL APPOINTMENTS THIS MONTH:', totalAppointments);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAppointments();


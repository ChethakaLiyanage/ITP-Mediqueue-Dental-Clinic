// Cleanup job to delete cancelled appointments after 3 hours
const cron = require('node-cron');
const Appointment = require('../Model/AppointmentModel');
const ScheduleModel = require('../Model/ScheduleModel');

const cleanupCancelledAppointments = async () => {
  try {
    console.log('🧹 Starting cleanup of cancelled appointments...');
    
    // Find cancelled appointments older than 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    const cancelledAppointments = await Appointment.find({
      status: 'cancelled',
      updatedAt: { $lt: threeHoursAgo }
    });
    
    console.log(`🔍 Found ${cancelledAppointments.length} cancelled appointments to clean up`);
    
    if (cancelledAppointments.length > 0) {
      // Get appointment IDs for cleanup
      const appointmentIds = cancelledAppointments.map(apt => apt._id);
      const appointmentCodes = cancelledAppointments.map(apt => apt.appointmentCode);
      
      // Delete appointments from AppointmentModel
      const deleteResult = await Appointment.deleteMany({
        _id: { $in: appointmentIds }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} cancelled appointments from AppointmentModel`);
      
      // Clean up corresponding schedule slots
      const scheduleCleanupResult = await ScheduleModel.deleteMany({
        appointmentId: { $in: appointmentCodes }
      });
      
      console.log(`✅ Cleaned up ${scheduleCleanupResult.deletedCount} corresponding schedule slots`);
      
      // Log details of cleaned appointments
      cancelledAppointments.forEach(apt => {
        console.log(`  🗑️ Cleaned: ${apt.appointmentCode} (${apt.dentistCode}) - ${apt.appointmentDate.toLocaleString()}`);
      });
    } else {
      console.log('✅ No cancelled appointments to clean up');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Run cleanup every hour
const startCleanupJob = () => {
  console.log('⏰ Starting cancelled appointments cleanup job (runs every hour)');
  
  // Run immediately on startup
  cleanupCancelledAppointments();
  
  // Schedule to run every hour
  cron.schedule('0 * * * *', () => {
    console.log('🕐 Running scheduled cleanup of cancelled appointments...');
    cleanupCancelledAppointments();
  });
};

module.exports = {
  cleanupCancelledAppointments,
  startCleanupJob
};

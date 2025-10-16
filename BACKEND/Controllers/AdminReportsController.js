const User = require("../Model/User");
const PatientModel = require("../Model/PatientModel");
const UnregisteredPatientModel = require("../Model/UnregisteredPatientModel");
const AppointmentModel = require("../Model/AppointmentModel");
const ClinicEventModel = require("../Model/ClinicEventModel");
const InquiryModel = require("../Model/InquiryModel");
const DentistModel = require("../Model/DentistModel");
const ReceptionistModel = require("../Model/ReceptionistModel");
const AdminModel = require("../Model/AdminModel");
const ManagerModel = require("../Model/ManagerModel"); // Manager model import

// Get Dashboard Overview Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('Dashboard stats requested');
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Staff Statistics
    console.log('Fetching staff statistics...');
    let totalStaff = 0, activeDentists = 0, activeReceptionists = 0, activeManagers = 0, activeAdmins = 0;
    
    try {
      totalStaff = await User.countDocuments({ role: { $in: ['Dentist', 'Receptionist', 'Admin', 'Manager'] } });
      activeDentists = await User.countDocuments({ role: 'Dentist', isActive: true });
      activeReceptionists = await User.countDocuments({ role: 'Receptionist', isActive: true });
      activeManagers = await User.countDocuments({ role: 'Manager', isActive: true });
      activeAdmins = await User.countDocuments({ role: 'Admin', isActive: true });
      console.log('Staff stats:', { totalStaff, activeDentists, activeReceptionists, activeManagers, activeAdmins });
    } catch (staffError) {
      console.error('Staff statistics error:', staffError);
      // Continue with default values instead of throwing
    }

    // Patient Statistics
    let totalRegisteredPatients = 0, totalUnregisteredPatients = 0, newPatientsThisPeriod = 0;
    
    try {
      totalRegisteredPatients = await PatientModel.countDocuments();
      totalUnregisteredPatients = await UnregisteredPatientModel.countDocuments();
      newPatientsThisPeriod = await PatientModel.countDocuments({
        createdAt: { $gte: startDate }
      });
    } catch (patientError) {
      console.error('Patient statistics error:', patientError);
    }

    // Appointment Statistics
    let totalAppointments = 0, appointmentsThisPeriod = 0, pendingAppointments = 0, confirmedAppointments = 0, completedAppointments = 0;
    
    try {
      totalAppointments = await AppointmentModel.countDocuments();
      appointmentsThisPeriod = await AppointmentModel.countDocuments({
        createdAt: { $gte: startDate }
      });
      pendingAppointments = await AppointmentModel.countDocuments({ status: 'pending' });
      confirmedAppointments = await AppointmentModel.countDocuments({ status: 'confirmed' });
      completedAppointments = await AppointmentModel.countDocuments({ status: 'completed' });
    } catch (appointmentError) {
      console.error('Appointment statistics error:', appointmentError);
    }

    // Activity Statistics
    let clinicEventsThisPeriod = 0, inquiriesThisPeriod = 0;
    
    try {
      clinicEventsThisPeriod = await ClinicEventModel.countDocuments({
        createdAt: { $gte: startDate }
      });
      inquiriesThisPeriod = await InquiryModel.countDocuments({
        createdAt: { $gte: startDate }
      });
    } catch (activityError) {
      console.error('Activity statistics error:', activityError);
    }

    // Recent Activity Trends (last 7 days)
    const last7Days = [];
    try {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));

        const dayStats = {
          date: dayStart.toISOString().split('T')[0],
          appointments: await AppointmentModel.countDocuments({
            createdAt: { $gte: dayStart, $lte: dayEnd }
          }),
          patients: await PatientModel.countDocuments({
            createdAt: { $gte: dayStart, $lte: dayEnd }
          }),
          inquiries: await InquiryModel.countDocuments({
            createdAt: { $gte: dayStart, $lte: dayEnd }
          })
        };
        last7Days.push(dayStats);
      }
    } catch (trendsError) {
      console.error('Trends statistics error:', trendsError);
    }

    const dashboardStats = {
      period: `Last ${period} days`,
      staff: {
        total: totalStaff,
        dentists: activeDentists,
        receptionists: activeReceptionists,
        managers: activeManagers,
        admins: activeAdmins
      },
      patients: {
        totalRegistered: totalRegisteredPatients,
        totalUnregistered: totalUnregisteredPatients,
        total: totalRegisteredPatients + totalUnregisteredPatients,
        newThisPeriod: newPatientsThisPeriod
      },
      appointments: {
        total: totalAppointments,
        thisPeriod: appointmentsThisPeriod,
        pending: pendingAppointments,
        confirmed: confirmedAppointments,
        completed: completedAppointments
      },
      activities: {
        clinicEvents: clinicEventsThisPeriod,
        inquiries: inquiriesThisPeriod
      },
      trends: last7Days
    };

    return res.status(200).json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    console.error("getDashboardStats error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
      stack: error.stack
    });
  }
};

// Get Staff Report
exports.getStaffReport = async (req, res) => {
  try {
    const { format = 'json', role, status } = req.query;

    // Build filter
    const filter = { role: { $in: ['Dentist', 'Manager', 'Receptionist', 'Admin'] } };
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.isActive = status === 'active';

    // Get staff with role-specific data
    const staff = await User.find(filter).select('-password').lean();
    
    const staffWithDetails = await Promise.all(
      staff.map(async (user) => {
        let roleData = null;
        try {
          switch (user.role) {
            case 'Dentist':
              roleData = await DentistModel.findOne({ userId: user._id }).lean();
              break;
            case 'Manager':
              roleData = await ManagerModel.findOne({ userId: user._id }).lean();
              break;
            case 'Receptionist':
              roleData = await ReceptionistModel.findOne({ userId: user._id }).lean();
              break;
            case 'Admin':
              roleData = await AdminModel.findOne({ userId: user._id }).lean();
              break;
          }
        } catch (roleErr) {
          console.error(`Error fetching role data for ${user.role}:`, roleErr);
        }
        
        return {
          ...user,
          roleData: roleData || {}
        };
      })
    );

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Name,Email,Role,Contact,Status,Join Date,Role Code,Department\n';
      const csvData = staffWithDetails.map(staff => {
        const roleCode = staff.roleData?.dentistCode || staff.roleData?.managerCode || 
                        staff.roleData?.receptionistCode || staff.roleData?.adminCode || 'N/A';
        const department = staff.roleData?.department || staff.roleData?.specialization || 'N/A';
        
        return `"${staff.name}","${staff.email}","${staff.role}","${staff.contact_no || 'N/A'}","${staff.isActive ? 'Active' : 'Inactive'}","${new Date(staff.createdAt).toLocaleDateString()}","${roleCode}","${department}"`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="staff_report_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvHeader + csvData);
    }

    return res.status(200).json({
      success: true,
      data: {
        staff: staffWithDetails,
        summary: {
          total: staffWithDetails.length,
          active: staffWithDetails.filter(s => s.isActive).length,
          inactive: staffWithDetails.filter(s => !s.isActive).length,
          byRole: {
            dentists: staffWithDetails.filter(s => s.role === 'Dentist').length,
            managers: staffWithDetails.filter(s => s.role === 'Manager').length,
            receptionists: staffWithDetails.filter(s => s.role === 'Receptionist').length,
            admins: staffWithDetails.filter(s => s.role === 'Admin').length
          }
        }
      }
    });

  } catch (error) {
    console.error("getStaffReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate staff report",
      error: error.message
    });
  }
};

// Get Patient Report
exports.getPatientReport = async (req, res) => {
  try {
    const { format = 'json', patientType, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let registeredPatients = [];
    let unregisteredPatients = [];

    if (patientType === 'all' || patientType === 'registered' || !patientType) {
      registeredPatients = await PatientModel.find({
        createdAt: { $gte: startDate }
      }).populate('userId', 'name email phone contact_no').lean();
    }

    if (patientType === 'all' || patientType === 'unregistered' || !patientType) {
      unregisteredPatients = await UnregisteredPatientModel.find({
        createdAt: { $gte: startDate }
      }).lean();
    }

    // Combine and format patients
    const allPatients = [
      ...registeredPatients.map(p => ({
        patientCode: p.patientCode,
        name: p.userId?.name || 'N/A',
        email: p.userId?.email || 'N/A',
        contact: p.userId?.contact_no || p.userId?.phone || 'N/A',
        age: p.age || 'N/A',
        gender: p.gender || 'N/A',
        type: 'Registered',
        status: 'Active',
        registeredDate: p.createdAt,
        registeredBy: 'System'
      })),
      ...unregisteredPatients.map(p => ({
        patientCode: p.patientCode,
        name: p.name || 'N/A',
        email: p.email || 'N/A',
        contact: p.phone || 'N/A',
        age: p.age || 'N/A',
        gender: p.gender || 'N/A',
        type: 'Unregistered',
        status: 'Temporary',
        registeredDate: p.createdAt,
        registeredBy: p.registeredBy || 'System'
      }))
    ];

    if (format === 'csv') {
      const csvHeader = 'Patient Code,Name,Email,Contact,Age,Gender,Type,Status,Registered Date,Registered By\n';
      const csvData = allPatients.map(patient => 
        `"${patient.patientCode}","${patient.name}","${patient.email}","${patient.contact}","${patient.age}","${patient.gender}","${patient.type}","${patient.status}","${new Date(patient.registeredDate).toLocaleDateString()}","${patient.registeredBy}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="patient_report_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvHeader + csvData);
    }

    return res.status(200).json({
      success: true,
      data: {
        patients: allPatients,
        summary: {
          total: allPatients.length,
          registered: registeredPatients.length,
          unregistered: unregisteredPatients.length,
          byGender: {
            male: allPatients.filter(p => p.gender?.toLowerCase() === 'male').length,
            female: allPatients.filter(p => p.gender?.toLowerCase() === 'female').length,
            other: allPatients.filter(p => p.gender && !['male', 'female'].includes(p.gender.toLowerCase())).length
          },
          ageGroups: {
            children: allPatients.filter(p => p.age && parseInt(p.age) < 18).length,
            adults: allPatients.filter(p => p.age && parseInt(p.age) >= 18 && parseInt(p.age) < 65).length,
            seniors: allPatients.filter(p => p.age && parseInt(p.age) >= 65).length
          }
        }
      }
    });

  } catch (error) {
    console.error("getPatientReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate patient report",
      error: error.message
    });
  }
};

// Get Appointment Report
exports.getAppointmentReport = async (req, res) => {
  try {
    const { format = 'json', status, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Build filter
    const filter = { createdAt: { $gte: startDate } };
    if (status && status !== 'all') filter.status = status;

    const appointments = await AppointmentModel.find(filter)
      .populate('patientId', 'name email phone')
      .populate('dentistId', 'name specialization')
      .populate('createdBy', 'name')
      .lean();

    const formattedAppointments = appointments.map(apt => ({
      appointmentId: apt._id,
      patientName: apt.patientId?.name || 'N/A',
      patientEmail: apt.patientId?.email || 'N/A',
      dentistName: apt.dentistId?.name || 'N/A',
      specialization: apt.dentistId?.specialization || 'N/A',
      appointmentDate: apt.appointmentDate,
      timeSlot: apt.timeSlot,
      status: apt.status,
      reason: apt.reason || 'N/A',
      notes: apt.notes || 'N/A',
      createdBy: apt.createdBy?.name || 'System',
      createdDate: apt.createdAt
    }));

    if (format === 'csv') {
      const csvHeader = 'Appointment ID,Patient Name,Patient Email,Dentist,Specialization,Date,Time,Status,Reason,Created By,Created Date\n';
      const csvData = formattedAppointments.map(apt => 
        `"${apt.appointmentId}","${apt.patientName}","${apt.patientEmail}","${apt.dentistName}","${apt.specialization}","${new Date(apt.appointmentDate).toLocaleDateString()}","${apt.timeSlot}","${apt.status}","${apt.reason}","${apt.createdBy}","${new Date(apt.createdDate).toLocaleDateString()}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="appointment_report_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvHeader + csvData);
    }

    return res.status(200).json({
      success: true,
      data: {
        appointments: formattedAppointments,
        summary: {
          total: formattedAppointments.length,
          byStatus: {
            pending: formattedAppointments.filter(a => a.status === 'pending').length,
            confirmed: formattedAppointments.filter(a => a.status === 'confirmed').length,
            completed: formattedAppointments.filter(a => a.status === 'completed').length,
            cancelled: formattedAppointments.filter(a => a.status === 'cancelled').length
          },
          byDentist: formattedAppointments.reduce((acc, apt) => {
            acc[apt.dentistName] = (acc[apt.dentistName] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error("getAppointmentReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate appointment report",
      error: error.message
    });
  }
};

// Get Activity Report
exports.getActivityReport = async (req, res) => {
  try {
    const { format = 'json', period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get clinic events
    const clinicEvents = await ClinicEventModel.find({
      createdAt: { $gte: startDate }
    }).populate('createdBy', 'name').lean();

    // Get inquiries
    const inquiries = await InquiryModel.find({
      createdAt: { $gte: startDate }
    }).populate('createdBy', 'name').lean();

    const activities = [
      ...clinicEvents.map(event => ({
        type: 'Clinic Event',
        title: event.title || 'N/A',
        description: event.description || 'N/A',
        createdBy: event.createdBy?.name || 'System',
        createdDate: event.createdAt,
        status: event.status || 'N/A'
      })),
      ...inquiries.map(inquiry => ({
        type: 'Inquiry',
        title: inquiry.subject || 'N/A',
        description: inquiry.message || 'N/A',
        createdBy: inquiry.createdBy?.name || 'System',
        createdDate: inquiry.createdAt,
        status: inquiry.status || 'N/A'
      }))
    ].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

    if (format === 'csv') {
      const csvHeader = 'Type,Title,Description,Created By,Created Date,Status\n';
      const csvData = activities.map(activity => 
        `"${activity.type}","${activity.title}","${activity.description}","${activity.createdBy}","${new Date(activity.createdDate).toLocaleDateString()}","${activity.status}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity_report_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvHeader + csvData);
    }

    return res.status(200).json({
      success: true,
      data: {
        activities,
        summary: {
          total: activities.length,
          clinicEvents: clinicEvents.length,
          inquiries: inquiries.length,
          byCreator: activities.reduce((acc, activity) => {
            acc[activity.createdBy] = (acc[activity.createdBy] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error("getActivityReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate activity report",
      error: error.message
    });
  }
};

const Appointment = require("../Model/AppointmentModel");
const Dentist = require("../Model/DentistModel");
const Feedback = require("../Model/FeedbackModel");
const InventoryItem = require("../Model/Inventory");
const InventoryRequest = require("../Model/InventoryRequest");
const Queue = require("../Model/QueueModel");
const Patient = require("../Model/PatientModel");
const User = require("../Model/User");

// Get Dashboard Overview Statistics
const getDashboardStats = async (req, res) => {
  try {
    console.log('Manager dashboard stats requested');
    
    // Get date range (default to last 30 days)
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Parallel data fetching for better performance
    const [
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalPatients,
      totalDentists,
      activeDentists,
      lowStockItems,
      avgRating,
      totalRevenue
    ] = await Promise.all([
      // Appointments
      Appointment.countDocuments({}),
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'completed' }),
      
      // Patients
      Patient.countDocuments({}),
      
      // Dentists
      Dentist.countDocuments({}),
      Dentist.countDocuments({ isActive: true }),
      
      // Inventory
      InventoryItem.countDocuments({ 
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] } 
      }),
      
      // Feedback
      Feedback.aggregate([
        { $group: { _id: null, avgRating: { $avg: "$rating" } } }
      ]),
      
      // Revenue (mock calculation - you can implement actual revenue tracking)
      Appointment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ["$fee", 0] } } } }
      ])
    ]);

    const stats = {
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalPatients,
      totalDentists,
      activeDentists,
      lowStockItems,
      avgRating: avgRating[0]?.avgRating || 0,
      totalRevenue: totalRevenue[0]?.totalRevenue || 0
    };

    console.log('Dashboard stats calculated:', stats);
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch dashboard statistics', 
      error: error.message 
    });
  }
};

// Get Dentist Performance Report
const getDentistPerformance = async (req, res) => {
  try {
    console.log('Dentist performance report requested');
    
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get dentist workload data
    const dentistWorkload = await Queue.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$dentistCode",
          totalPatients: { $sum: 1 },
          completedPatients: { 
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } 
          },
          inTreatmentPatients: { 
            $sum: { $cond: [{ $eq: ["$status", "in_treatment"] }, 1, 0] } 
          },
          waitingPatients: { 
            $sum: { $cond: [{ $eq: ["$status", "waiting"] }, 1, 0] } 
          }
        }
      }
    ]);

    // Get dentist details
    const dentists = await Dentist.find({})
      .populate('userId', 'name email')
      .select('dentistCode specialization isActive');

    // Combine data
    const performanceData = dentists.map(dentist => {
      const workload = dentistWorkload.find(w => w._id === dentist.dentistCode) || {
        totalPatients: 0,
        completedPatients: 0,
        inTreatmentPatients: 0,
        waitingPatients: 0
      };

      const completionRate = workload.totalPatients > 0 
        ? (workload.completedPatients / workload.totalPatients) * 100 
        : 0;

      return {
        dentistId: dentist._id,
        dentistCode: dentist.dentistCode,
        name: dentist.userId?.name || 'Unknown',
        email: dentist.userId?.email || '',
        specialization: dentist.specialization || 'General',
        isActive: dentist.isActive,
        totalPatients: workload.totalPatients,
        completedPatients: workload.completedPatients,
        inTreatmentPatients: workload.inTreatmentPatients,
        waitingPatients: workload.waitingPatients,
        completionRate: Math.round(completionRate * 100) / 100
      };
    }).sort((a, b) => b.totalPatients - a.totalPatients);

    console.log('Dentist performance data calculated');
    return res.status(200).json({ performance: performanceData });
  } catch (error) {
    console.error('Error fetching dentist performance:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch dentist performance data', 
      error: error.message 
    });
  }
};

// Get Inventory Report
const getInventoryReport = async (req, res) => {
  try {
    console.log('Inventory report requested');
    
    // Get inventory items with low stock
    const lowStockItems = await InventoryItem.find({
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] }
    }).select('name sku quantity lowStockThreshold category');

    // Get inventory usage (from requests)
    const inventoryUsage = await InventoryRequest.aggregate([
      {
        $group: {
          _id: "$item",
          totalRequested: { $sum: "$quantity" },
          totalApproved: { 
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$quantity", 0] } 
          },
          totalRejected: { 
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, "$quantity", 0] } 
          }
        }
      },
      {
        $lookup: {
          from: "inventoryitems",
          localField: "_id",
          foreignField: "_id",
          as: "itemDetails"
        }
      },
      {
        $unwind: "$itemDetails"
      },
      {
        $project: {
          itemName: "$itemDetails.name",
          itemSku: "$itemDetails.sku",
          currentStock: "$itemDetails.quantity",
          lowStockThreshold: "$itemDetails.lowStockThreshold",
          totalRequested: 1,
          totalApproved: 1,
          totalRejected: 1
        }
      },
      {
        $sort: { totalRequested: -1 }
      }
    ]);

    // Get total inventory value
    const totalInventoryValue = await InventoryItem.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$unitPrice", 0] }] } }
        }
      }
    ]);

    const report = {
      lowStockItems,
      inventoryUsage,
      totalInventoryValue: totalInventoryValue[0]?.totalValue || 0,
      totalItems: await InventoryItem.countDocuments(),
      lowStockCount: lowStockItems.length
    };

    console.log('Inventory report generated');
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching inventory report:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch inventory report', 
      error: error.message 
    });
  }
};

// Get Patient Statistics Report
const getPatientStatistics = async (req, res) => {
  try {
    console.log('Patient statistics report requested');
    
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get patient statistics
    const [
      totalPatients,
      newPatients,
      patientAgeGroups,
      patientGenderStats,
      appointmentStats
    ] = await Promise.all([
      // Total patients
      Patient.countDocuments({}),
      
      // New patients in period
      Patient.countDocuments({ createdAt: { $gte: startDate } }),
      
      // Age group distribution
      Patient.aggregate([
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ["$age", 18] }, then: "Under 18" },
                  { case: { $lt: ["$age", 30] }, then: "18-29" },
                  { case: { $lt: ["$age", 45] }, then: "30-44" },
                  { case: { $lt: ["$age", 60] }, then: "45-59" },
                  { case: { $gte: ["$age", 60] }, then: "60+" }
                ],
                default: "Unknown"
              }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Gender distribution
      Patient.aggregate([
        {
          $group: {
            _id: "$gender",
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Appointment statistics
      Appointment.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const statistics = {
      totalPatients,
      newPatients,
      ageGroups: patientAgeGroups,
      genderDistribution: patientGenderStats,
      appointmentStatus: appointmentStats
    };

    console.log('Patient statistics calculated');
    return res.status(200).json(statistics);
  } catch (error) {
    console.error('Error fetching patient statistics:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch patient statistics', 
      error: error.message 
    });
  }
};

// Get Financial Report (Basic)
const getFinancialReport = async (req, res) => {
  try {
    console.log('Financial report requested');
    
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get financial data from appointments
    const financialData = await Appointment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          dailyRevenue: { $sum: { $ifNull: ["$fee", 0] } },
          appointmentCount: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);

    // Calculate totals
    const totalRevenue = financialData.reduce((sum, day) => sum + day.dailyRevenue, 0);
    const totalAppointments = financialData.reduce((sum, day) => sum + day.appointmentCount, 0);
    const averageRevenuePerAppointment = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

    const report = {
      period: `${period} days`,
      totalRevenue,
      totalAppointments,
      averageRevenuePerAppointment: Math.round(averageRevenuePerAppointment * 100) / 100,
      dailyBreakdown: financialData
    };

    console.log('Financial report generated');
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching financial report:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch financial report', 
      error: error.message 
    });
  }
};

// Get Recent Activity for Dashboard
const getRecentActivity = async (req, res) => {
  try {
    console.log('Recent activity requested');
    
    const limit = parseInt(req.query.limit) || 10;
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent appointments
    const recentAppointments = await Appointment.find({
      createdAt: { $gte: last24Hours },
      isActive: true
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    // Get recent inventory requests
    const recentInventoryRequests = await InventoryRequest.find({
      createdAt: { $gte: last24Hours }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

    // Get recent feedback
    const recentFeedback = await Feedback.find({
      createdAt: { $gte: last24Hours }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

    // Format activities
    const activities = [];

    // Add appointment activities
    recentAppointments.forEach(appointment => {
      const patientName = appointment.guestInfo?.name || 
                         appointment.otherPersonDetails?.name || 
                         `Patient ${appointment.patient_code}` || 
                         'Unknown Patient';
      const dentistName = `Dr. ${appointment.dentist_code}` || 'Unknown Dentist';
      
      activities.push({
        id: `appointment_${appointment._id}`,
        type: 'appointment',
        title: `New ${appointment.status} appointment`,
        description: `${patientName} - ${dentistName}`,
        timestamp: appointment.createdAt,
        status: appointment.status,
        icon: '📅'
      });
    });

    // Add inventory request activities
    recentInventoryRequests.forEach(request => {
      activities.push({
        id: `inventory_${request._id}`,
        type: 'inventory',
        title: 'Inventory request',
        description: `Request for ${request.items?.length || 0} items`,
        timestamp: request.createdAt,
        status: request.status,
        icon: '📦'
      });
    });

    // Add feedback activities
    recentFeedback.forEach(feedback => {
      activities.push({
        id: `feedback_${feedback._id}`,
        type: 'feedback',
        title: 'New patient feedback',
        description: `Rating: ${feedback.rating}/5 stars`,
        timestamp: feedback.createdAt,
        status: 'completed',
        icon: '⭐'
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    console.log(`Recent activity: ${limitedActivities.length} items`);
    return res.status(200).json({
      activities: limitedActivities,
      total: activities.length
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch recent activity', 
      error: error.message 
    });
  }
};

module.exports = {
  getDashboardStats,
  getDentistPerformance,
  getInventoryReport,
  getPatientStatistics,
  getFinancialReport,
  getRecentActivity
};

const express = require("express");
const admin_router = express.Router();

const adminController = require("../Controllers/AdminControllers");
const adminClinicEventController = require("../Controllers/AdminClinicEventControllers");
const adminInquiryController = require("../Controllers/AdminInquiryControllers");
const adminPatientController = require("../Controllers/AdminPatientControllers");
const patientManagementController = require("../Controllers/PatientManagementControllers");
const adminReportsController = require("../Controllers/AdminReportsController");
const adminAppointmentController = require("../Controllers/AdminAppointmentControllers");
const { uploadDentistPhoto, handleUploadError } = require("../middleware/upload");

// =============================
// Staff Management Routes
// =============================
admin_router.post("/staff", uploadDentistPhoto, handleUploadError, adminController.createStaff);
admin_router.get("/code/:adminCode", adminController.getAdminByCode);
admin_router.get("/staff", adminController.getAllStaff);
admin_router.get("/staff/:id", adminController.getStaffById);
admin_router.put("/staff/:id", adminController.updateStaff);
admin_router.delete("/staff/:id", adminController.deleteStaff);


// =============================
// Clinic Event Routes (Receptionist Activities)
// =============================
admin_router.get("/clinic-events/receptionist-activities", adminClinicEventController.getReceptionistActivities);
admin_router.get("/clinic-events/receptionists", adminClinicEventController.getActiveReceptionists);
admin_router.get("/clinic-events/stats", adminClinicEventController.getReceptionistActivityStats);
admin_router.get("/clinic-events/all", adminClinicEventController.getAllClinicEvents);

// =============================
// Inquiry Routes (Receptionist Activities)
// =============================
admin_router.get("/inquiries/receptionist-activities", adminInquiryController.getReceptionistInquiryActivities);
admin_router.get("/inquiries/receptionists", adminInquiryController.getActiveInquiryReceptionists);
admin_router.get("/inquiries/stats", adminInquiryController.getInquiryActivityStats);
admin_router.get("/inquiries/all", adminInquiryController.getAllInquiries);

// =============================
// Patient Registration Routes (Receptionist Activities)
// =============================
admin_router.get("/patients/receptionist-activities", adminPatientController.getReceptionistPatientActivities);
admin_router.get("/patients/receptionists", adminPatientController.getActivePatientReceptionists);
admin_router.get("/patients/stats", adminPatientController.getPatientRegistrationStats);
admin_router.get("/patients/all", adminPatientController.getAllPatients);

// =============================
// Appointment Routes (Receptionist Activities)
// =============================
admin_router.get("/appointments/receptionist-activities", adminAppointmentController.getReceptionistAppointmentActivities);
admin_router.get("/appointments/receptionists", adminAppointmentController.getActiveAppointmentReceptionists);

// =============================
// Patient Management Routes
// =============================
admin_router.get("/patient-management/all", patientManagementController.getAllPatientsForManagement);
admin_router.get("/patient-management/overview-stats", patientManagementController.getOverviewStats);
admin_router.get("/patient-management/stats", patientManagementController.getPatientStats);
admin_router.get("/patient-management/debug", patientManagementController.debugPatientCounts);
admin_router.post("/patient-management/create-test-unregistered", patientManagementController.createTestUnregisteredPatient);
admin_router.put("/patient-management/promote/:id", patientManagementController.promoteUnregisteredPatient);
admin_router.delete("/patient-management/:id", patientManagementController.deletePatient);

// =============================
// Reports Routes
// =============================
admin_router.get("/reports/dashboard-stats", adminReportsController.getDashboardStats); // Dashboard stats route - updated
admin_router.get("/reports/staff", adminReportsController.getStaffReport);
admin_router.get("/reports/patients", adminReportsController.getPatientReport);
admin_router.get("/reports/appointments", adminReportsController.getAppointmentReport);
admin_router.get("/reports/activities", adminReportsController.getActivityReport);

// =============================
// Test route
// =============================
admin_router.get("/test", (req, res) => {
  res.json({ message: "Admin routes working!" });
});

module.exports = admin_router;

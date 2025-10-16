//password-ALIAhm9ZCkV2vxRx
const path = require("path");
require("dotenv").config();
require("events").EventEmitter.defaultMaxListeners = 20;

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001"
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// Import route files
const router = require("./Routes/DentistRoutes");
const treatmentplan_router = require("./Routes/DentistTreatmentplanRoutes");
const patientTreatmentplan_router = require("./Routes/PatientTreatmentplanRoutes");
const patientPrescription_router = require("./Routes/PatientPrescriptionRoutes");
const Patient_router = require("./Routes/PatientRoutes");
const Prescription_router = require("./Routes/DentistPrescriptionRoutes");
const Feedback_router = require("./Routes/FeedbackRoutes");
const Appointment_router = require("./Routes/AppointmentRoutes");
const GuestAppointment_router = require("./Routes/GuestAppointmentRoutes");
const auth_router = require("./Routes/DentistauthRoutes");
const { login, registerPatient, forgotPassword, resetPassword } = require("./Controllers/DentistAuthControllers");
const User_router = require("./Routes/UserRoutes");
const Inventory_router = require("./Routes/DentistInventoryRoutes");
const event_router = require("./Routes/DentistClinicEventRoutes");
const Leave_router = require("./Routes/LeaveRoutes");
const Schedule_router = require("./Routes/ScheduleRoutes");
const Queue_router = require("./Routes/QueueRoutes");
const DentistQueue_router = require("./Routes/DentistQueueRoutes");
const manager_router = require("./Routes/ManagerRoutes");
const admin_router = require("./Routes/AdminRoutes");
const managerAuth_router = require("./Routes/ManagerAuthRoutes");
const inventory_router = require("./Routes/InventoryRoutes");
const inventoryRequest_router = require("./Routes/InventoryRequestRoutes");
const notification_router = require("./Routes/InventoryNotificationRoutes");
const receptionistDashboard_router = require("./Routes/ReceptionistDashboardRoutes");
const receptionist_router = require("./Routes/ReceptionistRoutes");
const receptionistAuth_router = require("./Routes/ReceptionistAuthRoutes");
const receptionistSchedule_router = require("./Routes/ReceptionistScheduleRoutes");
const receptionistPatient_router = require("./Routes/ReceptionistPatientRoutes");
const receptionistAppointment_router = require("./Routes/ReceptionistAppointmentRoutes");
const receptionistUnregisteredPatient_router = require("./Routes/ReceptionistUnregisteredPatientRoutes");
const receptionistQueue_router = require("./Routes/ReceptionistQueueRoutes");
const receptionistDentist_router = require("./Routes/ReceptionistDentistRoutes");
const receptionistInquiry_router = require("./Routes/ReceptionistInquiryRoutes");
const receptionistNotification_router = require("./Routes/ReceptionistNotificationRoutes");
const patientInquiry_router = require("./Routes/PatientInquiryRoutes");
const profile_router = require("./routes/profileRoutes");
const managerReport_router = require("./Routes/managerReportRoutes");

const app = express();

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth routes
app.use("/auth", auth_router);
app.use("/auth/manager", managerAuth_router);
app.use("/auth/receptionist", receptionistAuth_router);
// app.use("/receptionist", receptionistAuth_router); // Removed - conflicts with inquiry routes
app.use("/auth", profile_router);

// Backward-compatible direct auth endpoints
app.post("/login", login);
app.post("/register-patient", registerPatient);
app.post("/forgot-password", forgotPassword);
app.post("/reset-password", resetPassword);

// API routes
app.use("/dentists", router);
app.use("/treatmentplans", treatmentplan_router);
app.use("/api/treatmentplans", patientTreatmentplan_router);
app.use("/api/prescriptions", patientPrescription_router);
app.use("/patients", Patient_router);
app.use("/api/patients", Patient_router); // Add API prefix for frontend compatibility
app.use("/prescriptions", Prescription_router);
app.use("/feedbacks", Feedback_router);
app.use("/appointments", Appointment_router);
app.use("/api/guest-appointments", GuestAppointment_router);
app.use("/users", User_router);
app.use("/inventory", Inventory_router);
app.use("/events", event_router);
app.use("/leave", Leave_router);
app.use("/schedules", Schedule_router);
app.use("/api/queue", Queue_router);
app.use("/api/dentist-queue", DentistQueue_router);
app.use("/admin", admin_router);
app.use("/managers", manager_router);
app.use("/api/inventory", inventory_router);
app.use("/api/inventory-requests", inventoryRequest_router);
app.use("/api/inventory-notifications", notification_router);
app.use("/api/receptionist", receptionistDashboard_router);
app.use("/api/receptionist", receptionist_router);
app.use("/receptionist/schedule", receptionistSchedule_router);
app.use("/receptionist/patients", receptionistPatient_router);
app.use("/receptionist/dentists", receptionistDentist_router);
app.use("/receptionist/appointments", receptionistAppointment_router);
app.use("/receptionist/unregistered-patients", receptionistUnregisteredPatient_router);
app.use("/receptionist/queue", receptionistQueue_router);
app.use("/receptionist/inquiries", receptionistInquiry_router);
app.use("/receptionist/notifications", receptionistNotification_router);
app.use("/api/inquiries", patientInquiry_router);
app.use("/api/manager/reports", managerReport_router);

if (!global.__listeners_bound) {
  process.on("unhandledRejection", (e) => {
    console.error("UNHANDLED REJECTION", e);
    process.exit(1);
  });
  global.__listeners_bound = true;
}

mongoose.connect(process.env.MONGO_URI, {
  dbName: "Mediqueue_dental_clinic",
})
.then(() => {
  console.log("Connected to MongoDB");
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
})
.catch((err) => console.error("MongoDB connection error:", err));








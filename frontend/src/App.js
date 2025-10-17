// src/App.jsx (or App.js)
import "./global-styles.css";
import { Routes, Route, Navigate } from "react-router-dom";
import DentistLogin from "./Components/Login/Login";
import DentistNav from "./Components/Nav/DentistNav";
import DashboardMetrics from "./Components/Dashboard/DashboardMetrics";
import FeedbackPage from "./Components/Feedback/DentistFeedbackPage";
import InventoryRequestForm from "./Components/Inventory/InventoryRequestForm";
import DentistInventoryRequestsPage from "./Components/Inventory/DentistInventoryRequestsPage";
import TreatmentPlansList from "./Components/TreatmentPlans/DentistTreatmentPlansList";
import DentistTreatmentPlanHistoryPage from "./Components/TreatmentPlans/DentistTreatmentPlanHistoryPage";
import PrescriptionsView from "./Components/Prescriptions/DentistPrescriptionsPage";
import PrescriptionHistoryPage from "./Components/Prescriptions/DentistPrescriptionHistoryPage";
import DentistProfilePage from "./Components/Profile/DentistProfilePage";
import EventsModulePage from "./Components/Events/DentistEventsPage";
import LeavePage from "./Components/Leave/DentistLeavePage";
import DentistSchedulesPage from "./Components/Schedules/DentistSchedulesPage";
import InventoryNotification from "./Components/Notification/InventoryNotification";
import AdminNav from "./Components/Nav/AdminNav";
import AdminDashboard from "./Components/Dashboard/Admindashboard";
import StaffManagement from "./Components/Admin/StaffManagement";
import ReceptionistActivities from "./Components/Admin/ReceptionistActivities";
import PatientManagement from "./Components/Admin/PatientManagement";
import AdminProfilePage from "./Components/Profile/AdminProfilePage";
import AdminReports from "./Components/Admin/AdminReports";
import ReceptionistNav from "./Components/Nav/ReceptionistNav";
import ReceptionistProfile from "./Components/Profile/ReceptionistProfile";
import ForgotPassword from "./Components/Auth/ForgotPassword";
import ResetPassword from "./Components/Auth/ResetPassword";
import PatientRegister from "./Components/Register/PatientRegister";
import ManagerNav from "./Components/Nav/ManagerNav";
import ManagerDashboard from "./Components/Dashboard/ManagerDashboard";
import Inventory from "./Components/Inventory/Inventory";
import InventoryRequestReading from "./Components/Inventory/Inventoryrequestreading";
import Reports from "./Components/Pages/Reports";
import AdminFeedbackPage from "./Components/Feedback/AdminFeedbackPage";
import ManagerProfilePage from "./Components/Profile/ManagerProfilePage";
import ReceptionistDashboard from "./Components/Dashboard/ReceptionistDashboard";
import ReceptionistEvents from "./Components/Events/ReceptionistEvents";
import ReceptionistSchedule from "./Components/Schedules/ReceptionistSchedule";
import ReceptionistQueue from "./Components/Queue/ReceptionistQueue";
import ReceptionistInquiries from "./Components/Inquiries/ReceptionistInquiries";
import ReceptionistInquiryDetail from "./Components/Inquiries/ReceptionistInquiryDetail";
import ReceptionistPatients from "./Components/Patients/ReceptionistPatients";
import ReceptionistDentists from "./Components/Dentists/ReceptionistDentists";
import ReceptionistUnregisteredPatients from "./Components/Patients/ReceptionistUnregisteredPatients";
import Profile from "./Components/Profile/Profile";
import ProfilePrescriptions from "./Components/Profile/ProfilePrescriptions";
import ProfilePrescriptionDetail from "./Components/Profile/ProfilePrescriptionDetail";
import ProfileTreatments from "./Components/Profile/ProfileTreatments";
import ProfileTreatmentDetail from "./Components/Profile/ProfileTreatmentDetail";
import ProfileInquiries from "./Components/Profile/ProfileInquiries";
import PatientReviews from "./Components/Review/MyReviews";
import ReceptionistLeave from "./Components/Leave/ReceptionistLeave";
import ReceptionistNotifications from "./Components/Notification/ReceptionistNotifications";
import Home from "./Components/Home/Home";
import ProfileUpdate from "./Components/Profile/ProfileUpdate";
import MedicalHistory from "./Components/Profile/MedicalHistory";
import ProtectedRoute from "./Components/Auth/ProtectedRoute";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<DentistLogin />} />
      {/* Dentist routes */}
      <Route path="/dentist" element={<DentistNav />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardMetrics />} />
        <Route path="profile" element={<DentistProfilePage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="inventory" element={<InventoryRequestForm />} />
        <Route path="inventory/request" element={<InventoryRequestForm />} />
        <Route path="inventory/requests" element={<DentistInventoryRequestsPage />} />
        <Route path="inventory/notifications" element={<InventoryNotification />} />
        <Route path="treatmentplans" element={<TreatmentPlansList />} />
        <Route path="treatmentplans/history" element={<DentistTreatmentPlanHistoryPage />} />
        <Route path="prescriptions" element={<PrescriptionsView />} />
        <Route path="prescriptions/history" element={<PrescriptionHistoryPage />} />
        <Route path="events" element={<EventsModulePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="schedules" element={<DentistSchedulesPage />} />
      </Route>
      {/* Admin routes */}
      <Route path="/admin" element={<AdminNav />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="patients" element={<PatientManagement />} />
        <Route path="receptionist-activities" element={<ReceptionistActivities />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
      </Route>
      {/* Manager routes */}
      <Route path="/manager" element={<ManagerNav />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory-request" element={<InventoryRequestReading />} />
        <Route path="reports" element={<Reports />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="profile" element={<ManagerProfilePage />} />
      </Route>
      {/* Receptionist routes */}
      <Route path="/receptionist" element={<ReceptionistNav />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ReceptionistDashboard />} />
        <Route path="profile" element={<ReceptionistProfile />} />
        <Route path="events" element={<ReceptionistEvents />} />
        <Route path="schedule" element={<ReceptionistSchedule />} />
        <Route path="queue" element={<ReceptionistQueue />} />
        <Route path="inquiries" element={<ReceptionistInquiries />} />
        <Route path="inquiries/:code" element={<ReceptionistInquiryDetail />} />
        <Route path="patients" element={<ReceptionistPatients />} />
        <Route path="dentists" element={<ReceptionistDentists />} />
        <Route path="unregistered" element={<ReceptionistUnregisteredPatients />} />
        <Route path="leaves" element={<ReceptionistLeave />} />
        <Route path="notifications" element={<ReceptionistNotifications />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register-patient" element={<PatientRegister />} />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      {/* Patient Profile sub-routes */}
      <Route path="/profile/update" element={
        <ProtectedRoute>
          <ProfileUpdate />
        </ProtectedRoute>
      } />
      <Route path="/profile/prescriptions" element={
        <ProtectedRoute>
          <ProfilePrescriptions />
        </ProtectedRoute>
      } />
      <Route path="/profile/prescriptions/:id" element={
        <ProtectedRoute>
          <ProfilePrescriptionDetail />
        </ProtectedRoute>
      } />
      <Route path="/profile/treatments" element={
        <ProtectedRoute>
          <ProfileTreatments />
        </ProtectedRoute>
      } />
      <Route path="/profile/treatments/:id" element={
        <ProtectedRoute>
          <ProfileTreatmentDetail />
        </ProtectedRoute>
      } />
      <Route path="/profile/reviews" element={
        <ProtectedRoute>
          <PatientReviews />
        </ProtectedRoute>
      } />
      <Route path="/profile/inquiries" element={
        <ProtectedRoute>
          <ProfileInquiries />
        </ProtectedRoute>
      } />
      <Route path="/profile/medical-history" element={
        <ProtectedRoute>
          <MedicalHistory />
        </ProtectedRoute>
      } />
    </Routes>
  );
}







import React, { useEffect, useState, useMemo } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import "./dentistnav.css";
import InventoryNotificationModal from "../Notifications/InventoryNotificationModal";

function useAuthUser() {
  const read = () => {
    try { return JSON.parse(localStorage.getItem("auth") || "{}"); } catch { return {}; }
  };
  const [auth, setAuth] = useState(read);

  useEffect(() => {
    const onChange = () => setAuth(read());
    window.addEventListener("storage", onChange);
    window.addEventListener("auth-change", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("auth-change", onChange);
    };
  }, []);
  return auth;
}

export default function DentistNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthUser();
  const userData = auth?.user;

  const initials = (userData?.name || "Dr")
    .split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  // Sidebar responsive states
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Notification states
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const sidebarClasses = useMemo(() => {
    const classes = ["dent-aside"];
    if (collapsed) classes.push("collapsed");
    if (mobileOpen) classes.push("mobile-open");
    return classes.join(" ");
  }, [collapsed, mobileOpen]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login", { replace: true });
  };

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setMobileOpen(prev => !prev);
    } else {
      setCollapsed(prev => !prev);
    }
  };

  return (
    <div className="dent-shell">
      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Brand Section */}
        <div className="dent-brand">
          <div className="dent-logo">🦷</div>
          <div>
            <div className="dent-brand-title">Mediqueue Dental Clinic</div>
            <div className="dent-brand-sub">Dentist Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="dent-nav">
          <NavLink to="/dentist/dashboard" className="dent-link">
            <span className="dent-ico">📊</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/dentist/prescriptions" className="dent-link">
            <span className="dent-ico">💊</span>
            <span>Prescriptions</span>
          </NavLink>
          <NavLink to="/dentist/treatmentplans" className="dent-link">
            <span className="dent-ico">📋</span>
            <span>Treatment Plans</span>
          </NavLink>
          <NavLink to="/dentist/inventory/request" className="dent-link">
            <span className="dent-ico">📦</span>
            <span>Inventory</span>
          </NavLink>
          <NavLink to="/dentist/events" className="dent-link">
            <span className="dent-ico">📅</span>
            <span>Events</span>
          </NavLink>
          <NavLink to="/dentist/leave" className="dent-link">
            <span className="dent-ico">🏖️</span>
            <span>Leave</span>
          </NavLink>
          <NavLink to="/dentist/schedules" className="dent-link">
            <span className="dent-ico">🗓️</span>
            <span>Schedules</span>
          </NavLink>
          <NavLink to="/dentist/feedback" className="dent-link">
            <span className="dent-ico">⭐</span>
            <span>Feedback</span>
          </NavLink>
        </nav>

        {/* Profile Section */}
        <div className="dent-profile">
          <NavLink to="/dentist/profile" className="dent-profile-link">
            <div className="dent-avatar">{initials}</div>
            <div className="dent-prof-text">
              <div className="dent-prof-name">{userData?.name || "Dentist"}</div>
              <div className="dent-prof-role">Dentist</div>
            </div>
          </NavLink>
          <button className="dent-logout" onClick={logout} title="Sign out">×</button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="dent-main">
        <div className="dent-topbar">
          <div className="dent-topbar-left">
            <button className="dent-toggle-btn" onClick={toggleSidebar} aria-label="Toggle navigation sidebar">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="dent-page-title">
              {location.pathname.replace("/dentist/", "").toUpperCase() || "DASHBOARD"}
            </div>
          </div>
          <div className="dent-topbar-actions">
            <button 
              className="dent-notification-btn" 
              onClick={() => setShowNotificationModal(true)}
              title="Inventory Requests Status"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828zM4.828 17h8l-2.586-2.586a2 2 0 00-2.828 0L4.828 17z"/>
              </svg>
              {notificationCount > 0 && (
                <span className="dent-notification-badge">{notificationCount}</span>
              )}
            </button>
          </div>
        </div>
        <div className="dent-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      <div className={`dent-overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
      
      {/* Inventory Notification Modal */}
      <InventoryNotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        dentistCode={userData?.dentistCode}
        onNotificationCountChange={setNotificationCount}
      />
    </div>
  );
}
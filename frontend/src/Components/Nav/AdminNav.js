import React, { useEffect, useState, useMemo } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import "./adminnav.css";

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

export default function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthUser();
  const userData = auth?.user;

  const initials = (userData?.name || "Ad")
    .split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  // Sidebar responsive states
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarClasses = useMemo(() => {
    const classes = ["admin-aside"];
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
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Brand Section */}
        <div className="admin-brand">
          <div className="admin-logo">🦷</div>
          <div>
            <div className="admin-brand-title">Mediqueue Dental Clinic</div>
            <div className="admin-brand-sub">Admin Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-nav">
          <NavLink to="/admin/dashboard" className="admin-link">
            <span className="admin-ico">📊</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/staff" className="admin-link">
            <span className="admin-ico">👥</span>
            <span>Staff Management</span>
          </NavLink>
          <NavLink to="/admin/patients" className="admin-link">
            <span className="admin-ico">🏥</span>
            <span>Patient Management</span>
          </NavLink>
          <NavLink to="/admin/receptionist-activities" className="admin-link">
            <span className="admin-ico">📋</span>
            <span>Receptionist Activities</span>
          </NavLink>
          <NavLink to="/admin/reports" className="admin-link">
            <span className="admin-ico">📈</span>
            <span>Reports</span>
          </NavLink>
          <NavLink to="/admin/feedback" className="admin-link">
            <span className="admin-ico">💬</span>
            <span>Feedback</span>
          </NavLink>
        </nav>

        {/* Profile Section */}
        <div className="admin-profile">
          <NavLink to="/admin/profile" className="admin-profile-link">
            <div className="admin-avatar">{initials}</div>
            <div className="admin-prof-text">
              <div className="admin-prof-name">{userData?.name || "Admin"}</div>
              <div className="admin-prof-role">Administrator</div>
            </div>
          </NavLink>
          <button className="admin-logout" onClick={logout} title="Sign out">×</button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="admin-main">
        <div className="admin-topbar">
          <button className="admin-toggle-btn" onClick={toggleSidebar} aria-label="Toggle navigation sidebar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="admin-page-title">
            {location.pathname.replace("/admin/", "").toUpperCase() || "DASHBOARD"}
          </div>
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      <div className={`admin-overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
    </div>
  );
}
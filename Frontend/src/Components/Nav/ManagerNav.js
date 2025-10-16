import React, { useEffect, useState, useMemo } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import "./managernav.css";

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

export default function ManagerNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthUser();
  const userData = auth?.user;

  const initials = (userData?.name || "Mgr")
    .split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  // Sidebar responsive states
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarClasses = useMemo(() => {
    const classes = ["mgr-aside"];
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
    <div className="mgr-shell">
      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Brand Section */}
        <div className="mgr-brand">
          <div className="mgr-logo">🦷</div>
          <div>
            <div className="mgr-brand-title">Mediqueue Dental Clinic</div>
            <div className="mgr-brand-sub">Manager Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mgr-nav">
          <NavLink to="/manager/dashboard" className="mgr-link">
            <span className="mgr-ico">📊</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/manager/inventory" className="mgr-link">
            <span className="mgr-ico">📦</span>
            <span>Inventory</span>
          </NavLink>
          <NavLink to="/manager/inventory-request" className="mgr-link">
            <span className="mgr-ico">📋</span>
            <span>Inventory Request</span>
          </NavLink>
          <NavLink to="/manager/reports" className="mgr-link">
            <span className="mgr-ico">📊</span>
            <span>Reports</span>
          </NavLink>
          <NavLink to="/manager/feedback" className="mgr-link">
            <span className="mgr-ico">💬</span>
            <span>Feedback</span>
          </NavLink>
        </nav>

        {/* Profile Section */}
        <div className="mgr-profile">
          <NavLink to="/manager/profile" className="mgr-profile-link">
            <div className="mgr-avatar">{initials}</div>
            <div className="mgr-prof-text">
              <div className="mgr-prof-name">{userData?.name || "Manager"}</div>
              <div className="mgr-prof-role">Manager</div>
            </div>
          </NavLink>
          <button className="mgr-logout" onClick={logout} title="Sign out">×</button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="mgr-main">
        <div className="mgr-topbar">
          <button className="mgr-toggle-btn" onClick={toggleSidebar} aria-label="Toggle navigation sidebar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="mgr-page-title">
            {location.pathname.replace("/manager/", "").toUpperCase() || "DASHBOARD"}
          </div>
        </div>
        <div className="mgr-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      <div className={`mgr-overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
    </div>
  );
}
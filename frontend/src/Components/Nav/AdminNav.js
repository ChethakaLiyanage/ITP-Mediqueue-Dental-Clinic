import React, { useEffect, useState } from "react";
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

function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const auth = useAuthUser();

  const handleLogout = () => {
    localStorage.removeItem("auth");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/login");
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const navItems = [
    {
      path: "/admin/dashboard",
      label: "Dashboard",
      icon: "📊"
    },
    {
      path: "/admin/staff",
      label: "Staff Management",
      icon: "👥"
    },
    {
      path: "/admin/patients",
      label: "Patient Management",
      icon: "🏥"
    },
    {
      path: "/admin/receptionist-activities",
      label: "Receptionist Activities",
      icon: "📋"
    },
    {
      path: "/admin/reports",
      label: "Reports",
      icon: "📈"
    },
    {
      path: "/admin/feedback",
      label: "Feedback",
      icon: "💬"
    }
  ];

  return (
    <div className="admin-shell">
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="admin-overlay active" 
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-aside ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
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
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `admin-link ${isActive ? 'active' : ''}`
              }
              onClick={closeMobileSidebar}
            >
              <span className="admin-ico">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Profile Section */}
        <div className="admin-profile">
          <div className="admin-profile-link">
            <div className="admin-avatar">
              {auth.name ? auth.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="admin-prof-text">
              <div className="admin-prof-name">
                {auth.name || 'Administrator'}
              </div>
              <div className="admin-prof-role">Administrator</div>
            </div>
          </div>
          <button 
            className="admin-logout" 
            onClick={handleLogout}
            title="Logout"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Bar */}
        <div className="admin-topbar">
          <button 
            className="admin-toggle-btn" 
            onClick={toggleSidebar}
            title="Toggle Sidebar"
          >
            ☰
          </button>
          <h1 className="admin-page-title">
            {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
          </h1>
        </div>

        {/* Content Area */}
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminNav;
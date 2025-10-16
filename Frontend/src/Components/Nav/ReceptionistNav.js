import React, { useEffect, useState, useMemo } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import "./receptionistnav.css";

function useAuthUser() {
  const read = () => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  };
  const [user, setUser] = useState(read);

  useEffect(() => {
    const onChange = () => setUser(read());
    window.addEventListener("storage", onChange);
    window.addEventListener("auth:changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("auth:changed", onChange);
    };
  }, []);
  return user;
}

export default function ReceptionistNav() {
  const navigate = useNavigate();
  const location = useLocation();
  // Get user from auth context or localStorage
  const u = useAuthUser();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Try to get user data from localStorage first
    const getAuthData = () => {
      try {
        const authData = JSON.parse(localStorage.getItem('auth'));
        if (authData?.user) {
          setUserData(authData.user);
        } else if (u) {
          setUserData(u);
        }
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    };

    // Initial check
    getAuthData();

    // Listen for auth changes
    const handleStorageChange = () => {
      getAuthData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth:changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:changed', handleStorageChange);
    };
  }, [u]);

  const initials = (userData?.name || "Rc")
    .split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();

  // Sidebar responsive states
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarClasses = useMemo(() => {
    const classes = ["rc-aside"];
    if (collapsed) classes.push("collapsed");
    if (mobileOpen) classes.push("mobile-open");
    return classes.join(" ");
  }, [collapsed, mobileOpen]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:changed"));
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
    <div className="rc-shell">
      {/* Sidebar */}
      <aside className={sidebarClasses}>
        {/* Brand Section */}
        <div className="rc-brand">
          <div className="rc-logo">🦷</div>
          <div>
            <div className="rc-brand-title">Mediqueue Dental Clinic</div>
            <div className="rc-brand-sub">Receptionist Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="rc-nav">
          <NavLink to="/receptionist/dashboard" className="rc-link"><span className="rc-ico"></span><span>Dashboard</span></NavLink>
          <NavLink to="/receptionist/profile" className="rc-link"><span className="rc-ico"></span><span>Profile</span></NavLink>
          <NavLink to="/receptionist/events" className="rc-link"><span className="rc-ico"></span><span>Events</span></NavLink>
          <NavLink to="/receptionist/schedule" className="rc-link"><span className="rc-ico"></span><span>Schedules</span></NavLink>
          <NavLink to="/receptionist/appointments" className="rc-link"><span className="rc-ico"></span><span>Appointments</span></NavLink>
          <NavLink to="/receptionist/queue" className="rc-link"><span className="rc-ico"></span><span>Queue</span></NavLink>
          <NavLink to="/receptionist/inquiries" className="rc-link"><span className="rc-ico"></span><span>Inquiries</span></NavLink>
          <NavLink to="/receptionist/patients" className="rc-link"><span className="rc-ico"></span><span>Patients</span></NavLink>
          <NavLink to="/receptionist/dentists" className="rc-link"><span className="rc-ico"></span><span>Dentists</span></NavLink>
          <NavLink to="/receptionist/unregistered" className="rc-link"><span className="rc-ico"></span><span>Unregistered</span></NavLink>
          <NavLink to="/receptionist/leaves" className="rc-link"><span className="rc-ico"></span><span>Leaves</span></NavLink>
          <NavLink to="/receptionist/notifications" className="rc-link"><span className="rc-ico"></span><span>Notifications</span></NavLink>
        </nav>

        {/* Profile Section */}
        <div className="rc-profile">
          <NavLink to="/receptionist/profile" className="rc-profile-link">
            <div className="rc-avatar">{initials}</div>
            <div className="rc-prof-text">
              <div className="rc-prof-name">{userData?.name || "Receptionist"}</div>
              <div className="rc-prof-role">{userData?.role || "Front Desk"}</div>
            </div>
          </NavLink>
          <button className="rc-logout" onClick={logout} title="Sign out">×</button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="rc-main">
        <div className="top-bar">
          <button className="toggle-btn" onClick={toggleSidebar} aria-label="Toggle navigation sidebar">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="page-title">
            {location.pathname.replace("/receptionist/", "").toUpperCase() || "Dashboard"}
          </div>
        </div>
        <div className="content-area">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      <div className={`overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
    </div>
  );
}

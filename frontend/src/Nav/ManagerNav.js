import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./managernav.css";
import Inventory from "../Inventory/Inventory";
import ManagerProfilePage from "../Profile/ManagerProfilePage";
import InventoryRequestReading from "../Inventory/Inventoryrequestreading";
import Reports from "../Pages/Reports";

export default function ManagerNav() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const auth = useMemo(() => {
    try { 
      return JSON.parse(localStorage.getItem('auth') || '{}'); 
    } catch { 
      return {}; 
    }
  }, []);
  
  // Redirect to dentist dashboard if user is a dentist
  useEffect(() => {
    if (auth.role === 'Dentist' && !location.pathname.startsWith('/dentist')) {
      navigate('/dentist/dashboard');
    }
  }, [auth.role, location.pathname, navigate]);
  
  const managerCode = auth?.user?.managerCode || auth?.managerCode || '';
  const loggedInName = auth?.user?.name || '';
  const displayManagerName = loggedInName ? `Manager ${loggedInName}` : '';
  
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Inventory");
  const [pageTitle, setPageTitle] = useState("Inventory Management");

  // Set active page based on current route
  useEffect(() => {
    if (!location) return;
    
    const path = location.pathname || '';
    
    if (path.startsWith('/manager/inventory-request')) {
      setActive('Inventory Request');
      setPageTitle('Inventory Requests');
    } else if (path.startsWith('/manager/reports')) {
      setActive('Reports');
      setPageTitle('Reports & Analytics');
    } else if (path.startsWith('/manager/profile')) {
      setActive('Profile');
      setPageTitle('Profile Settings');
    } else if (path.startsWith('/manager/inventory')) {
      setActive('Inventory');
      setPageTitle('Inventory Management');
    } else {
      setActive('Inventory');
      setPageTitle('Inventory Management');
    }
  }, [location?.pathname]);

  const isMobile = () => window.innerWidth <= 768;

  // Handle window resize
  useEffect(() => {
    const onResize = () => {
      if (!isMobile()) {
        setMobileOpen(false);
      }
    };
    
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleSidebar = () => {
    if (isMobile()) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const handleSelect = (label) => {
    setActive(label);
    
    // Close mobile menu
    if (isMobile()) {
      setMobileOpen(false);
    }
    
    // Navigate to appropriate route
    switch (label) {
      case "Inventory":
        navigate("/manager/inventory");
        setPageTitle('Inventory Management');
        break;
      case "Inventory Request":
        navigate("/manager/inventory-request");
        setPageTitle('Inventory Requests');
        break;
      case "Reports":
        navigate("/manager/reports");
        setPageTitle('Reports & Analytics');
        break;
      case "Profile":
        navigate("/manager/profile");
        setPageTitle('Profile Settings');
        break;
      case "Login":
        navigate("/login");
        break;
      default:
        navigate("/manager/inventory");
        setPageTitle('Inventory Management');
    }
  };

  // Dynamic CSS classes
  const sidebarClasses = useMemo(() => {
    const classes = ["sidebar"];
    if (collapsed) classes.push("collapsed");
    if (mobileOpen) classes.push("mobile-open");
    return classes.join(" ");
  }, [collapsed, mobileOpen]);

  const mainClasses = useMemo(() => {
    const classes = ["main-content"];
    if (collapsed) classes.push("expanded");
    return classes.join(" ");
  }, [collapsed]);

  // Navigation links configuration
  const navigationLinks = [
    {
      label: "Inventory",
      icon: (
        <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      label: "Inventory Request",
      icon: (
        <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      label: "Reports",
      icon: (
        <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ];

  // User profile link (conditionally rendered)
  const userProfileLink = displayManagerName ? {
    label: displayManagerName,
    icon: (
      <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  } : null;

  // Render content based on current route
  const renderContent = () => {
    const path = location?.pathname || '';
    
    if (path.startsWith('/manager/inventory-request')) {
      return <InventoryRequestReading />;
    }
    if (path.startsWith('/manager/reports')) {
      return <Reports />;
    }
    if (path.startsWith('/manager/profile')) {
      return <ManagerProfilePage />;
    }
    if (path.startsWith('/manager/inventory')) {
      return <Inventory />;
    }
    
    // Default
    return <Inventory />;
  };

  return (
    <>
      <div className="app-container">
        {/* Professional Sidebar Navigation */}
        <aside className={sidebarClasses}>
          {/* Brand Section */}
          <div className="logo-section">
            <div className="logo">🦷</div>
            <div className="brand-info">
              <div className="brand-title">Mediqueue Dental Clinic</div>
              <div className="brand-subtitle">Manager Dashboard</div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="nav-menu" aria-label="Primary Navigation">
            <ul>
              {navigationLinks.map(({ label, icon }) => (
                <li className="nav-item" key={label}>
                  <button
                    type="button"
                    className={`nav-link ${active === label ? "active" : ""}`}
                    onClick={() => handleSelect(label)}
                    aria-label={label}
                    aria-current={active === label ? "page" : undefined}
                  >
                    {icon}
                    <span className="nav-text">{label}</span>
                    <div className="nav-tooltip">{label}</div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* User Profile Section */}
          {userProfileLink && (
            <div className="user-profile">
              <button
                type="button"
                className={`nav-link ${active === "Profile" ? "active" : ""}`}
                onClick={() => handleSelect("Profile")}
                aria-label={userProfileLink.label}
              >
                {userProfileLink.icon}
                <span className="nav-text">{userProfileLink.label}</span>
                <div className="nav-tooltip">{userProfileLink.label}</div>
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className={mainClasses}>
          {/* Top Navigation Bar */}
          <div className="top-bar">
            <button 
              className="toggle-btn" 
              onClick={toggleSidebar} 
              aria-label="Toggle navigation sidebar"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="page-title">{pageTitle}</div>

            <div className="top-bar-right">
              {/* Additional top bar items can be added here */}
            </div>
          </div>

          {/* Dynamic Content Area */}
          <div className="content-area">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`overlay ${mobileOpen ? "active" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
    </>
  );
}
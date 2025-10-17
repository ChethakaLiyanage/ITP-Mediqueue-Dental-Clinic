// src/Components/Home.js
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import PremiumFeedbackForm from "../Feedback/Feedback";
import "./home.css";
// import "../../utils/homePageTest"; // Disabled - just a test utility

const serviceDetails = {
  "General Dentistry": {
    title: "General Dentistry",
    subtitle: "Complete primary dental care for optimal oral health",
    overview: "Our general dentistry services form the foundation of excellent oral health. We provide comprehensive preventive and basic restorative care using modern techniques and state-of-the-art equipment to ensure your smile stays healthy and beautiful.",
    procedures: [
      "Routine dental examinations and oral health assessments",
      "Professional teeth cleaning and plaque removal",
      "Cavity detection and dental fillings",
      "Fluoride treatments and dental sealants",
      "Gum disease prevention and treatment",
      "Oral cancer screenings",
      "Dental emergency care"
    ],
    benefits: [
      "Prevents serious dental problems before they develop",
      "Early detection of oral health issues",
      "Maintains optimal oral hygiene",
      "Cost-effective preventive approach",
      "Preserves natural teeth structure",
      "Improves overall health and wellbeing"
    ],
    duration: "30-60 minutes",
    frequency: "Every 6 months",
    pricing: {
      "Consultation & Examination": "Rs. 2,500",
      "Professional Cleaning": "Rs. 4,000",
      "Fluoride Treatment": "Rs. 1,500",
      "Basic Filling": "Rs. 3,500"
    },
    specialists: ["Dr. Anura Silva", "Dr. Priya Mendis"]
  },
  "Restorative Dentistry": {
    title: "Restorative Dentistry",
    subtitle: "Professional restoration of damaged or missing teeth",
    overview: "Our restorative dentistry services focus on repairing and replacing damaged or missing teeth using advanced materials and techniques. We restore both function and aesthetics to give you back your confident smile.",
    procedures: [
      "Dental crowns and bridges",
      "Composite and ceramic fillings",
      "Dental implants and implant-supported prosthetics",
      "Partial and complete dentures",
      "Root canal therapy",
      "Tooth extractions",
      "Dental bonding and repair"
    ],
    benefits: [
      "Restores full chewing and speaking function",
      "Prevents further dental deterioration",
      "Maintains facial structure and appearance",
      "Long-lasting and durable solutions",
      "Natural-looking results",
      "Improves oral health and hygiene"
    ],
    duration: "45-120 minutes",
    frequency: "As needed",
    pricing: {
      "Dental Crown": "Rs. 25,000",
      "Dental Bridge": "Rs. 45,000",
      "Dental Implant": "Rs. 85,000",
      "Root Canal": "Rs. 15,000"
    },
    specialists: ["Dr. Rohan Perera", "Dr. Anura Silva"]
  },
  "Paediatric Dentistry": {
    title: "Paediatric Dentistry",
    subtitle: "Specialized dental care designed for children",
    overview: "Our pediatric dentistry services are specifically designed to provide gentle, comprehensive dental care for infants, children, and teenagers. We create positive dental experiences that establish lifelong oral health habits.",
    procedures: [
      "Child-friendly dental examinations",
      "Preventive cleanings and fluoride treatments",
      "Dental sealants for cavity protection",
      "Early orthodontic assessments",
      "Treatment of childhood dental injuries",
      "Baby tooth extractions",
      "Habit counseling (thumb sucking, pacifier use)"
    ],
    benefits: [
      "Creates positive associations with dental care",
      "Prevents childhood dental anxiety",
      "Establishes good oral hygiene habits early",
      "Monitors proper dental development",
      "Prevents complex dental problems",
      "Family-centered care approach"
    ],
    duration: "30-45 minutes",
    frequency: "Every 6 months",
    pricing: {
      "Child Consultation": "Rs. 2,000",
      "Pediatric Cleaning": "Rs. 3,000",
      "Dental Sealants": "Rs. 2,500",
      "Fluoride Treatment": "Rs. 1,200"
    },
    specialists: ["Dr. Priya Mendis", "Dr. Saman Fernando"]
  },
  "Orthodontics": {
    title: "Orthodontics",
    subtitle: "Advanced treatment for perfectly aligned teeth",
    overview: "Our orthodontic services provide comprehensive treatment for tooth misalignment and jaw irregularities. Using modern techniques including traditional braces and clear aligners, we help you achieve the perfect smile.",
    procedures: [
      "Comprehensive orthodontic evaluations",
      "Traditional metal and ceramic braces",
      "Clear aligner therapy (Invisalign-style)",
      "Retainer fitting and maintenance",
      "Jaw growth modification therapy",
      "Space maintainers for children",
      "Treatment of bite irregularities"
    ],
    benefits: [
      "Improves bite function and chewing efficiency",
      "Enhances facial aesthetics and smile beauty",
      "Easier cleaning and better oral hygiene",
      "Prevents tooth wear and jaw problems",
      "Boosts confidence and self-esteem",
      "Long-term oral health benefits"
    ],
    duration: "12-24 months",
    frequency: "Monthly adjustments",
    pricing: {
      "Orthodontic Consultation": "Rs. 3,500",
      "Metal Braces": "Rs. 150,000",
      "Ceramic Braces": "Rs. 200,000",
      "Clear Aligners": "Rs. 250,000"
    },
    specialists: ["Dr. Kumari Jayasinghe", "Dr. Rohan Perera"]
  },
  "Smile Enhancement": {
    title: "Smile Enhancement",
    subtitle: "Cosmetic treatments for your most confident smile",
    overview: "Our smile enhancement services combine artistry with dental science to create beautiful, natural-looking smiles. From whitening to veneers, we offer comprehensive cosmetic solutions tailored to your aesthetic goals.",
    procedures: [
      "Professional teeth whitening treatments",
      "Porcelain and composite veneers",
      "Cosmetic bonding and contouring",
      "Gum reshaping and smile design",
      "Full mouth smile makeovers",
      "Aesthetic crown and bridge work",
      "Smile analysis and digital planning"
    ],
    benefits: [
      "Dramatically improves smile aesthetics",
      "Boosts confidence in social situations",
      "Natural-looking, beautiful results",
      "Minimally invasive procedures",
      "Long-lasting cosmetic improvements",
      "Customized to your facial features"
    ],
    duration: "60-180 minutes",
    frequency: "As desired",
    pricing: {
      "Teeth Whitening": "Rs. 12,000",
      "Porcelain Veneer": "Rs. 35,000",
      "Cosmetic Bonding": "Rs. 8,000",
      "Smile Makeover": "Rs. 200,000+"
    },
    specialists: ["Dr. Kumari Jayasinghe", "Dr. Anura Silva"]
  },
  "Advanced Diagnostics": {
    title: "Advanced Diagnostics",
    subtitle: "State-of-the-art technology for precise treatment planning",
    overview: "Our advanced diagnostic services utilize cutting-edge technology to provide accurate assessment and treatment planning. With digital imaging and in-house laboratory facilities, we ensure precise diagnosis and optimal treatment outcomes.",
    procedures: [
      "Digital X-rays and panoramic imaging",
      "3D CBCT scanning for implant planning",
      "Intraoral cameras for detailed examination",
      "Digital impressions and CAD/CAM technology",
      "Oral cancer screening with advanced detection",
      "Bite analysis and TMJ evaluation",
      "Periodontal probing and gum assessment"
    ],
    benefits: [
      "Accurate diagnosis with minimal radiation",
      "Faster treatment planning and execution",
      "Better patient education with visual aids",
      "Precise treatment outcomes",
      "Early detection of oral health issues",
      "Reduced treatment time and visits"
    ],
    duration: "15-45 minutes",
    frequency: "As needed for treatment",
    pricing: {
      "Digital X-Ray": "Rs. 1,500",
      "Panoramic X-Ray": "Rs. 3,000",
      "3D CBCT Scan": "Rs. 8,000",
      "Oral Cancer Screening": "Rs. 2,500"
    },
    specialists: ["All Specialists", "Diagnostic Team"]
  }
};

const services = [
  { icon: "fa-tooth", title: "General Dentistry", text: "Complete primary dental care including examinations, cleanings, preventive treatments, and oral health management for patients of all ages." },
  { icon: "fa-tools", title: "Restorative Dentistry", text: "Professional restoration of damaged or missing teeth using modern techniques including fillings, crowns, bridges, and implants." },
  { icon: "fa-child", title: "Paediatric Dentistry", text: "Specialized dental care for children focusing on oral health management, prevention, and creating positive dental experiences." },
  { icon: "fa-align-center", title: "Orthodontics", text: "Advanced treatment for tooth misalignment and jaw irregularities using modern braces and clear aligners for perfect smiles." },
  { icon: "fa-smile-beam", title: "Smile Enhancement", text: "Cosmetic dental treatments to enhance your smile including whitening, veneers, and aesthetic procedures for confidence boost." },
  { icon: "fa-x-ray", title: "Advanced Diagnostics", text: "State-of-the-art diagnostic equipment including digital X-rays and in-house lab facilities for accurate treatment planning." },
];

const features = [
  { icon: "fa-hospital", title: "State-of-the-Art Facility", text: "Modern equipment and technology ensuring the highest standards of dental care and patient safety." },
  { icon: "fa-user-md", title: "Expert Specialists", text: "Internationally trained and experienced doctors committed to providing exceptional dental care." },
  { icon: "fa-microscope", title: "In-House Lab & X-Ray", text: "Complete diagnostic facilities on-site for faster, more accurate treatment and convenience." },
  { icon: "fa-heart", title: "Comfortable Environment", text: "Friendly atmosphere designed to ease anxiety with ample parking and convenient location." },
];

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCheckAppointments, setShowCheckAppointments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authTrigger, setAuthTrigger] = useState(0); // Force re-render on auth changes
  const navigate = useNavigate();
  const showProfileButton = Boolean(user && isAuthenticated);

  // Add auth state change listener that forces re-render
  useEffect(() => {
    const handleAuthChange = () => {
      console.log('Auth state changed, forcing re-render');
      setAuthTrigger(prev => prev + 1); // Force component re-render
    };

    window.addEventListener("auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  // Debug logging to help identify issues
  console.log('Home component rendered for user:', user?.email || 'Not authenticated');
  console.log('Authentication status:', isAuthenticated);
  console.log('Auth trigger:', authTrigger);
  const handleScroll = useCallback(() => {
    const header = document.getElementById("header");
    const scrollTopBtn = document.getElementById("scrollTop");
    const scrollY = window.scrollY;
    
    if (scrollY > 100) {
      header?.classList.add("scrolled");
      scrollTopBtn?.classList.add("visible");
    } else {
      header?.classList.remove("scrolled");
      scrollTopBtn?.classList.remove("visible");
    }
  }, []);

  // Memoized parallax handler
  const handleParallax = useCallback(() => {
    const parallax = document.querySelector(".hero");
    const speed = window.pageYOffset * 0.5;
    if (parallax) {
      parallax.style.backgroundPosition = `center ${speed}px`;
    }
  }, []);

  useEffect(() => {
    // Enhanced loading screen
    const loading = document.getElementById("loading");
    const hideLoading = setTimeout(() => {
      loading?.classList.add("hidden");
      setIsLoading(false);
    }, 1200);

    // Optimized scroll handlers
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          handleParallax();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // Scroll to top functionality
    const scrollTopBtn = document.getElementById("scrollTop");
    const onTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
    scrollTopBtn?.addEventListener("click", onTop);

    // Enhanced smooth anchor scroll
    const anchors = document.querySelectorAll('a[href^="#"]');
    const clickHandlers = [];
    
    anchors.forEach((anchor) => {
      const handler = (e) => {
        const target = document.querySelector(anchor.getAttribute("href"));
        if (target) {
          e.preventDefault();
          const header = document.getElementById("header");
          const headerHeight = header?.offsetHeight || 80;
          const targetPosition = target.offsetTop - headerHeight - 20;
          
          window.scrollTo({ 
            top: targetPosition, 
            behavior: "smooth" 
          });
        }
      };
      anchor.addEventListener("click", handler);
      clickHandlers.push([anchor, handler]);
    });

    // Enhanced intersection observer with stagger
    const observerOptions = { 
      threshold: 0.15, 
      rootMargin: "0px 0px -80px 0px" 
    };
    
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }, index * 100); // Stagger animation
        }
      });
    }, observerOptions);

    const animElements = document.querySelectorAll(".service-card, .feature-item, .about-text");
    animElements.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(40px)";
      el.style.transition = "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      io.observe(el);
    });

    // Enhanced ripple effect
    const rippleTargets = document.querySelectorAll(".btn-primary, .btn-secondary, .service-link");
    const rippleHandlers = [];
    
    rippleTargets.forEach((btn) => {
      const handler = (e) => {
        const ripple = document.createElement("span");
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.5;
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        Object.assign(ripple.style, {
          position: "absolute",
          width: `${size}px`,
          height: `${size}px`,
          left: `${x}px`,
          top: `${y}px`,
          background: "rgba(255, 255, 255, 0.4)",
          borderRadius: "50%",
          transform: "scale(0)",
          animation: "ripple 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
          zIndex: "0"
        });
        
        btn.style.position = "relative";
        btn.style.overflow = "hidden";
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);
      };
      
      btn.addEventListener("click", handler);
      rippleHandlers.push([btn, handler]);
    });

    // Enhanced typing effect
    const heroTitle = document.querySelector(".hero h1");
    const typeWriter = (element, text, speed = 60) => {
      let i = 0;
      element.innerHTML = "";
      element.style.borderRight = "2px solid #fff";
      
      const typing = () => {
        if (i < text.length) {
          element.innerHTML += text.charAt(i);
          i++;
          setTimeout(typing, speed + Math.random() * 40);
        } else {
          setTimeout(() => {
            element.style.borderRight = "none";
          }, 500);
        }
      };
      typing();
    };

    const typingTimer = setTimeout(() => {
      if (heroTitle && !isLoading) {
        const originalText = heroTitle.textContent;
        typeWriter(heroTitle, originalText, 60);
      }
    }, 1800);

    // Cleanup
    return () => {
      clearTimeout(hideLoading);
      clearTimeout(typingTimer);
      window.removeEventListener("scroll", onScroll);
      scrollTopBtn?.removeEventListener("click", onTop);
      clickHandlers.forEach(([anchor, handler]) => 
        anchor.removeEventListener("click", handler)
      );
      rippleHandlers.forEach(([btn, handler]) => 
        btn.removeEventListener("click", handler)
      );
      io.disconnect();
    };
  }, [handleScroll, handleParallax, isLoading, user, isAuthenticated]); // Added auth state to dependencies


  // Enhanced modal handlers
  const openServiceModal = useCallback((serviceName) => {
    setSelectedService(serviceDetails[serviceName]);
    setShowServiceModal(true);
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = '15px'; // Prevent layout shift
  }, []);

  const closeServiceModal = useCallback(() => {
    setShowServiceModal(false);
    setSelectedService(null);
    document.body.style.overflow = 'unset';
    document.body.style.paddingRight = '0';
  }, []);

  const bookService = useCallback((serviceName) => {
    closeServiceModal();
    navigate('/book-appointment', { state: { selectedService: serviceName } });
  }, [closeServiceModal, navigate]);

  const handleLoginClick = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  const handleProfileClick = useCallback(() => {
    if (user?.role === "Patient") {
      navigate("/profile");
      return;
    }
    if (user?.role === "Dentist") {
      navigate("/dentist/profile");
      return;
    }
    if (user?.role === "Receptionist") {
      navigate("/receptionist/profile");
      return;
    }
    if (user?.role === "Manager") {
      navigate("/manager/profile");
      return;
    }
    if (user?.role === "Admin") {
      navigate("/admin/profile");
      return;
    }
    navigate("/login");
  }, [navigate, user]);

  const handleCheckAppointments = useCallback(() => {
    // Only allow unregistered users to check appointments
    if (isAuthenticated) {
      return;
    }
    
    setShowCheckAppointments(true);
    // Scroll to the check appointments section
    setTimeout(() => {
      const checkSection = document.getElementById('check-appointments');
      if (checkSection) {
        checkSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, [isAuthenticated]);

  const handleCloseCheckAppointments = useCallback(() => {
    setShowCheckAppointments(false);
  }, []);
  return (
    <div id="home-root" key={`home-${user?.email || 'anonymous'}-${authTrigger}`}>
      {/* ... */}
      {/* Enhanced Loading */}
      <div className="loading" id="loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <i className="fas fa-tooth"></i>
            <span>Medi Queue</span>
          </div>
        </div>
      </div>

      {/* Header with adjusted layout */}
      <header className="header" id="header">
        <div className="nav-container">
          <div className="logo">
            <i className="fas fa-tooth"></i>
            <span>Medi Queue</span>
          </div>
          <nav className="nav-menu">
            <a href="#home" className="nav-link">Home</a>
            <a href="#services" className="nav-link">Services</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#contact" className="nav-link">Contact</a>
          </nav>
          <div className="header-actions">
            {showProfileButton ? (
              <div className="auth-buttons">
                <button
                  onClick={handleProfileClick}
                  className="profile-btn"
                  aria-label="Profile"
                >
                  <i className="fas fa-user-circle"></i>
                  <span>{user ? user.name?.split(" ")[0] : "Profile"}</span>
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="auth-btn login-btn">
                  <i className="fas fa-sign-in-alt"></i>
                  <span>Sign In</span>
                </Link>
                <Link to="/register-patient" className="auth-btn register-btn">
                  <i className="fas fa-user-plus"></i>
                  <span>Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Enhanced Hero - Same content for all users */}
      <section className="hero" id="hero" data-consistent="true">
        <div className="hero-background">
          <div className="floating-icon floating-icon-1"><i className="fas fa-tooth"></i></div>
          <div className="floating-icon floating-icon-2"><i className="fas fa-smile"></i></div>
          <div className="floating-icon floating-icon-3"><i className="fas fa-heart"></i></div>
          <div className="floating-icon floating-icon-4"><i className="fas fa-stethoscope"></i></div>
          <div className="floating-icon floating-icon-5"><i className="fas fa-user-md"></i></div>
          <div className="floating-icon floating-icon-6"><i className="fas fa-microscope"></i></div>
          <div className="floating-icon floating-icon-7"><i className="fas fa-shield-alt"></i></div>
          <div className="floating-icon floating-icon-8"><i className="fas fa-plus-circle"></i></div>
        </div>

        <div className="hero-content">
          <h1>Your Smile is a Class Apart</h1>
          <p>
            Providing Sri Lankans with specialized dental treatment using modern techniques and state-of-the-art
            facilities. Experience comfort, professionalism, and excellence.
          </p>
          <div className="hero-buttons">
            <Link to="/book-appointment" className="btn-primary">
              <span>BOOK APPOINTMENT</span>
              <i className="fas fa-calendar-plus"></i>
            </Link>
            {!isAuthenticated && (
              <button onClick={handleCheckAppointments} className="btn-secondary">
                <span>CHECK APPOINTMENTS</span>
                <i className="fas fa-search"></i>
              </button>
            )}
            <a href="#services" className="btn-secondary">
              <span>OUR SERVICES</span>
              <i className="fas fa-arrow-down"></i>
            </a>
          </div>
        </div>
      </section>

      {/* Enhanced Services - Same content for all users */}
      <section className="services" id="services" data-consistent="true">
        <div className="container">
          <div className="section-title">
            <h2>Our Services</h2>
            <p>Comprehensive dental care for the whole family with modern techniques and experienced specialists</p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => (
              <div className="service-card" key={index} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="service-icon">
                  <i className={`fas ${service.icon}`}></i>
                </div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <button 
                  className="service-link"
                  onClick={() => openServiceModal(service.title)}
                  aria-label={`Learn more about ${service.title}`}
                >
                  <span>Learn More</span>
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Service Modal */}
      {showServiceModal && selectedService && (
        <div className="service-modal-overlay" onClick={closeServiceModal}>
          <div className="service-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="service-modal-header">
              <h2>{selectedService.title}</h2>
              <button 
                className="modal-close" 
                onClick={closeServiceModal}
                aria-label="Close modal"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="service-modal-body">
              <div className="service-hero">
                <h3>{selectedService.subtitle}</h3>
                <p className="service-overview">{selectedService.overview}</p>
              </div>

              <div className="service-details-grid">
                <div className="service-detail-section">
                  <h4><i className="fas fa-list-ul"></i> Procedures</h4>
                  <ul>
                    {selectedService.procedures.map((procedure, index) => (
                      <li key={index}>{procedure}</li>
                    ))}
                  </ul>
                </div>

                <div className="service-detail-section">
                  <h4><i className="fas fa-check-circle"></i> Benefits</h4>
                  <ul>
                    {selectedService.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </div>

                <div className="service-detail-section">
                  <h4><i className="fas fa-clock"></i> Treatment Info</h4>
                  <div className="treatment-info">
                    <p><strong>Duration:</strong> {selectedService.duration}</p>
                    <p><strong>Frequency:</strong> {selectedService.frequency}</p>
                  </div>
                </div>

                <div className="service-detail-section">
                  <h4><i className="fas fa-rupee-sign"></i> Pricing</h4>
                  <div className="pricing-list">
                    {Object.entries(selectedService.pricing).map(([service, price], index) => (
                      <div key={index} className="price-item">
                        <span>{service}</span>
                        <span className="price">{price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="service-detail-section">
                  <h4><i className="fas fa-user-md"></i> Our Specialists</h4>
                  <div className="specialists-list">
                    {selectedService.specialists.map((specialist, index) => (
                      <span key={index} className="specialist-tag">{specialist}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="service-modal-actions">
                <button 
                  className="btn-secondary"
                  onClick={closeServiceModal}
                >
                  Close
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => bookService(selectedService.title)}
                >
                  <i className="fas fa-calendar-plus"></i>
                  Book This Service
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check Appointments Section - Only for unregistered users */}
      {!isAuthenticated && showCheckAppointments && (
        <section className="check-appointments-section" id="check-appointments">
          <div className="container">
            <div className="section-header">
              <h2>Check Your Appointments</h2>
              <p>Please register or login to view and manage your appointments</p>
              <button 
                className="close-section-btn"
                onClick={handleCloseCheckAppointments}
                aria-label="Close check appointments section"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="appointment-message">
              <div className="message-content">
                <h3>Appointment Management</h3>
                <p>To book and manage appointments, please create an account or login to your existing account.</p>
                <div className="action-buttons">
                  <Link to="/register-patient" className="btn btn-primary">
                    Register Now
                  </Link>
                  <Link to="/login" className="btn btn-secondary">
                    Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Enhanced Why Choose Us - Same content for all users */}
      <section className="why-choose" id="why-choose" data-consistent="true">
        <div className="container">
          <div className="section-title">
            <h2>Why Choose Medi Queue?</h2>
            <p>Experience the difference with our commitment to excellence, modern technology, and patient-centered care</p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-item" key={index} style={{ animationDelay: `${index * 0.15}s` }}>
                <div className="feature-icon">
                  <i className={`fas ${feature.icon}`}></i>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced About - Same content for all users */}
      <section className="about" id="about" data-consistent="true">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <h2>About Medi Queue</h2>
              <p>Medi Queue was created to provide Sri Lankans with a specialized dental treatment center that uses modern dentistry techniques coupled with state-of-the-art facilities.</p>
              <p>Conveniently located with ample parking, our center is designed to provide you with comfort and set your mind at ease. Our professional, friendly team comprising of well-trained specialists will guide you every step of the way.</p>
              <p>We are open from 09 am to 07 pm from Thursday to Tuesday, ensuring your entire family has easy access to the best dental care facilities.</p>
              <Link to="/book-appointment" className="btn-primary">
                <span>Schedule Consultation</span>
                <i className="fas fa-calendar-check"></i>
              </Link>
            </div>
            <div className="about-image">
              <img
                src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><rect fill='%23f0f8ff' width='600' height='400'/><rect fill='%23e3f2fd' x='50' y='50' width='500' height='300' rx='20'/><rect fill='%23bbdefb' x='100' y='100' width='400' height='200' rx='10'/><circle fill='%232c5aa0' cx='300' cy='200' r='50'/><path fill='%23ff6b35' d='M280 180h40v40h-40z'/><text x='300' y='340' text-anchor='middle' font-family='Arial' font-size='24' fill='%232c5aa0'>Modern Dental Care</text></svg>"
                alt="Modern Dental Facility"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Contact - Same content for all users */}
      <section className="contact" id="contact" data-consistent="true">
        <div className="container">
          <div className="section-title">
            <h2>Contact Us</h2>
            <p>Get in touch with us to schedule your appointment or learn more about our services</p>
          </div>

          <div className="contact-grid">
            <div className="contact-info">
              <h3>Get In Touch</h3>
              <p>We're here to help you achieve your best smile. Contact us today to schedule your consultation.</p>

              <div className="contact-item">
                <i className="fas fa-phone"></i>
                <div>
                  <h4>Phone</h4>
                  <p>+94 11 2 123 456</p>
                </div>
              </div>

              <div className="contact-item">
                <i className="fas fa-envelope"></i>
                <div>
                  <h4>Email</h4>
                  <p>info@medi-queue.lk</p>
                </div>
              </div>

              <div className="contact-item">
                <i className="fas fa-map-marker-alt"></i>
                <div>
                  <h4>Location</h4>
                  <p>Mount Lavinia, Colombo<br/>Sri Lanka</p>
                </div>
              </div>

              <div className="contact-item">
                <i className="fas fa-clock"></i>
                <div>
                  <h4>Working Hours</h4>
                  <p>Thu - Tue: 09:00 AM - 07:00 PM<br/>Wednesday: Closed</p>
                </div>
              </div>
            </div>

            <div className="contact-form">
              <div className="contact-map-section">
                <h3>Find Us</h3>
                <p>Visit our modern dental facility located in Mount Lavinia.</p>
                <div className="location-card">
                  <i className="fas fa-map-marker-alt"></i>
                  <h4>Medi Queue Dental Center</h4>
                  <p>Mount Lavinia, Colombo<br/>Sri Lanka</p>
                  <span>Easy parking available</span>
                </div>
              </div>

              <div className="contact-feedback-section">
                <PremiumFeedbackForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className="footer" id="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <div className="footer-logo">
                <i className="fas fa-tooth"></i>
                <span>Medi Queue</span>
              </div>
              <p>Leading dental care provider in Sri Lanka, committed to providing exceptional oral health services with modern technology and experienced specialists.</p>
              <div className="social-links">
                <a href="#" aria-label="Facebook"><i className="fab fa-facebook"></i></a>
                <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
                <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
                <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
              </div>
            </div>

            <div className="footer-section">
              <h3>Services</h3>
              <ul>
                <li><a href="#">General Dentistry</a></li>
                <li><a href="#">Restorative Dentistry</a></li>
                <li><a href="#">Paediatric Dentistry</a></li>
                <li><a href="#">Orthodontics</a></li>
                <li><a href="#">Smile Enhancement</a></li>
              </ul>
            </div>

            <div className="footer-section">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About Us</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#contact">Contact</a></li>
                <li><Link to="/book-appointment">Book Appointment</Link></li>
              </ul>
            </div>

            <div className="footer-section">
              <h3>Contact Info</h3>
              <div className="footer-contact">
                <p><i className="fas fa-phone"></i> +94 11 2 123 456</p>
                <p><i className="fas fa-envelope"></i> info@medi-queue.lk</p>
                <p><i className="fas fa-map-marker-alt"></i> Mount Lavinia, Colombo</p>
                <p><i className="fas fa-clock"></i> Thu-Tue: 9AM-7PM</p>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2025 Medi Queue. All rights reserved. | Designed with care for better smiles</p>
          </div>
        </div>
      </footer>

      {/* Enhanced Scroll to Top */}
      <button className="scroll-top" id="scrollTop" aria-label="Scroll to top">
        <i className="fas fa-arrow-up"></i>
        <span className="scroll-progress"></span>
      </button>

      {/* Ripple animation CSS */}
      <style jsx>{`
        @keyframes ripple {
          to {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}




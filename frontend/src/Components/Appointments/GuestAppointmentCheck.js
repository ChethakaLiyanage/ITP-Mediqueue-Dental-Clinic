import React, { useState, useEffect, useMemo } from "react";
import { Search, Calendar, Clock, User, Phone, Mail, MapPin, Filter } from "lucide-react";

const apiBase = "http://localhost:5000";

export default function GuestAppointmentCheck() {
  const [searchInfo, setSearchInfo] = useState({
    email: "",
    phone: ""
  });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  
  // Advanced filters (same as registered users)
  const [dentistCode, setDentistCode] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [doctorNameQuery, setDoctorNameQuery] = useState("");
  const [dentists, setDentists] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Load dentists for filtering
  useEffect(() => {
    fetch(`${apiBase}/dentists`)
      .then((r) => r.json())
      .then((data) => setDentists(Array.isArray(data?.dentists) ? data.dentists : []))
      .catch(() => setDentists([]));
  }, []);

  // Dentist name lookup (same as registered users)
  const dentistNameByCode = useMemo(() => {
    const map = new Map();
    dentists.forEach((d) => {
      const code = d.dentistCode || d.code;
      if (!code) return;
      const name = d.userId?.name || d.displayName || d.name || `Dentist ${code}`;
      map.set(code, name);
    });
    return map;
  }, [dentists]);

  // Build query string (same as registered users)
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (searchInfo.email.trim()) p.set("guest_email", searchInfo.email.trim());
    if (searchInfo.phone.trim()) p.set("guest_phone", searchInfo.phone.trim());
    if (dentistCode) p.set("dentist_code", dentistCode.trim());
    if (status) p.set("status", status);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    return p.toString();
  }, [searchInfo.email, searchInfo.phone, dentistCode, status, from, to]);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchInfo.email.trim() && !searchInfo.phone.trim()) {
      setError("Please enter either email or phone number");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const url = `${apiBase}/appointments${qs ? `?${qs}` : ""}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        let arr = Array.isArray(data.items) ? data.items : [];
        
        // Filter by doctor name (same as registered users)
        const q = doctorNameQuery.trim().toLowerCase();
        if (q) {
          arr = arr.filter((a) => {
            const code = a.dentist_code || "";
            const name = dentistNameByCode.get(code) || code;
            return String(name).toLowerCase().includes(q);
          });
        }
        
        setAppointments(arr);
      } else {
        setError(data.message || "Failed to fetch appointments");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'confirmed': return '#10b981';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Confirmation';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #fff7ed 100%)',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)', color: 'white', padding: '4rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>Check Your Appointments</h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
            Enter your email or phone number to view your appointment history
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '-2rem auto 2rem', padding: '0 2rem' }}>
        <div style={{ background: 'white', borderRadius: '1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', padding: '2rem', border: '1px solid #e5e7eb' }}>
          
          {/* Search Form */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>
              <Search style={{ marginRight: '0.5rem', color: '#3b82f6' }} size={24} />
              Find Your Appointments
            </h3>

            <form onSubmit={handleSearch}>
              {/* Basic Search - Email/Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={searchInfo.email}
                      onChange={(e) => setSearchInfo({...searchInfo, email: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem', 
                        border: '2px solid #e5e7eb', 
                        borderRadius: '0.75rem', 
                        background: 'white', 
                        fontSize: '0.875rem' 
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                    <input
                      type="tel"
                      placeholder="Enter your phone number"
                      value={searchInfo.phone}
                      onChange={(e) => setSearchInfo({...searchInfo, phone: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem', 
                        border: '2px solid #e5e7eb', 
                        borderRadius: '0.75rem', 
                        background: 'white', 
                        fontSize: '0.875rem' 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Filters Toggle */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'transparent',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  <Filter size={18} />
                  {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
                </button>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                    Advanced Filters
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    {/* Dentist Filter */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Dentist
                      </label>
                      <select
                        value={dentistCode}
                        onChange={(e) => setDentistCode(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      >
                        <option value="">All Dentists</option>
                        {dentists.map((dentist) => (
                          <option key={dentist.dentistCode || dentist.code} value={dentist.dentistCode || dentist.code}>
                            {dentist.userId?.name || dentist.displayName || dentist.name || `Dentist ${dentist.dentistCode || dentist.code}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Date Range */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                    </div>

                    {/* Doctor Name Search */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Search by Doctor Name
                      </label>
                      <input
                        type="text"
                        placeholder="Enter doctor name to search"
                        value={doctorNameQuery}
                        onChange={(e) => setDoctorNameQuery(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {loading ? 'Searching...' : 'Search Appointments'}
              </button>
            </form>

            {error && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem' }}>
                <p style={{ color: '#dc2626', margin: 0, fontSize: '0.875rem' }}>{error}</p>
              </div>
            )}
          </div>

          {/* Results */}
          {searched && (
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                Your Appointments ({appointments.length})
              </h3>

              {appointments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No appointments found</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    {searchInfo.email || searchInfo.phone ? 
                      'No appointments found with the provided information.' : 
                      'Please enter your email or phone number to search.'
                    }
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {appointments.map((appointment) => (
                    <div
                      key={appointment._id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '1rem',
                        padding: '1.5rem',
                        background: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                        
                        {/* Appointment Details */}
                        <div>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                            Appointment Details
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <Calendar size={16} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {new Date(appointment.appointment_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <Clock size={16} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: 'white',
                                background: getStatusColor(appointment.status)
                              }}
                            >
                              {getStatusText(appointment.status)}
                            </span>
                          </div>
                        </div>

                        {/* Patient Info */}
                        <div>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                            Patient Information
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <User size={16} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {appointment.guestInfo?.name || 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <Mail size={16} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {appointment.guestInfo?.email || 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Phone size={16} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {appointment.guestInfo?.phone || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                            Additional Information
                          </h4>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>DENTIST CODE:</span>
                            <span style={{ fontSize: '0.875rem', color: '#374151', marginLeft: '0.5rem' }}>
                              {appointment.dentist_code}
                            </span>
                          </div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>APPOINTMENT ID:</span>
                            <span style={{ fontSize: '0.875rem', color: '#374151', marginLeft: '0.5rem' }}>
                              {appointment.appointmentCode || appointment._id.slice(-6)}
                            </span>
                          </div>
                          {appointment.reason && (
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>REASON:</span>
                              <span style={{ fontSize: '0.875rem', color: '#374151', marginLeft: '0.5rem' }}>
                                {appointment.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

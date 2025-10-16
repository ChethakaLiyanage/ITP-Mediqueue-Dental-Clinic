// src/Components/Dentists/ReceptionistDentists.js
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "../Dentists/receptionistdentists.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function formatSchedule(sch) {
  if (!sch || typeof sch !== "object") return "Not available";
  try {
    const entries = Object.entries(sch);
    if (entries.length === 0) return "Not available";
    
    // Debug log to see what we're getting
    console.log("Schedule data:", sch);
    console.log("Schedule entries:", entries);
    
    return entries
      .map(([day, hours]) => {
        console.log(`Processing day: ${day}, hours:`, hours, `type: ${typeof hours}`);
        
        // Handle different schedule formats
        if (typeof hours === 'string') {
          return `${day}: ${hours}`;
        } else if (typeof hours === 'object' && hours !== null) {
          // If hours is an object, try multiple approaches to extract time information
          
          // Approach 1: Look for start/end time properties
          const start = hours.start || hours.from || hours.startTime || hours.begin;
          const end = hours.end || hours.to || hours.endTime || hours.finish;
          
          if (start && end) {
            return `${day}: ${start}-${end}`;
          }
          
          // Approach 2: Look for a time string property
          if (hours.time && typeof hours.time === 'string') {
            return `${day}: ${hours.time}`;
          }
          
          // Approach 3: Look for hours property
          if (hours.hours && typeof hours.hours === 'string') {
            return `${day}: ${hours.hours}`;
          }
          
          // Approach 4: Look for period property
          if (hours.period && typeof hours.period === 'string') {
            return `${day}: ${hours.period}`;
          }
          
          // Approach 5: Try to extract any string value from the object
          const stringValues = Object.values(hours).filter(val => 
            typeof val === 'string' && val.trim() && 
            val !== '09:00' && val !== '17:00' &&
            !val.includes('object') && !val.includes('Object')
          );
          
          if (stringValues.length > 0) {
            return `${day}: ${stringValues[0]}`;
          }
          
          // Approach 6: If it's an array, join the values
          if (Array.isArray(hours) && hours.length > 0) {
            const validValues = hours.filter(val => typeof val === 'string' && val.trim());
            if (validValues.length > 0) {
              return `${day}: ${validValues.join(', ')}`;
            }
          }
          
          // Approach 7: Try to stringify and extract meaningful parts
          const objStr = JSON.stringify(hours);
          console.log(`Object string for ${day}:`, objStr);
          
          // If the object contains time-like patterns, try to extract them
          const timePattern = /(\d{1,2}:\d{2})/g;
          const timeMatches = objStr.match(timePattern);
          if (timeMatches && timeMatches.length >= 2) {
            return `${day}: ${timeMatches[0]}-${timeMatches[1]}`;
          } else if (timeMatches && timeMatches.length === 1) {
            return `${day}: ${timeMatches[0]}`;
          }
          
          return `${day}: Not available`;
        } else {
          return `${day}: Not available`;
        }
      })
      .join('\n'); // Use line breaks for better readability
  } catch (error) {
    console.error('Error formatting schedule:', error, sch);
    return "Not available";
  }
}

export default function ReceptionistDentists() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // NEW: separate search fields
  const [codeQuery, setCodeQuery] = useState("");
  const [specialization, setSpecialization] = useState(""); // "" = All

  // NEW: dropdown options
  const [specOptions, setSpecOptions] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // Build URL with both filters - use receptionist endpoint
  function buildListUrl({ code = "", spec = "" } = {}) {
    const qs = new URLSearchParams();
    if (code) qs.set("q", code.trim());                 // code (back-end matches code/specialization)
    if (spec) qs.set("specialization", spec);           // explicit specialization filter
    return `${API_BASE}/receptionist/dentists${qs.toString() ? `?${qs}` : ""}`;
  }

  async function fetchDentists({ code = codeQuery, spec = specialization } = {}) {
    setLoading(true);
    setError("");
    try {
      const url = buildListUrl({ code, spec });
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) {
        // Handle different response formats from backend
        let items = Array.isArray(data) ? data : 
                   Array.isArray(data.items) ? data.items : 
                   Array.isArray(data.dentists) ? data.dentists : [];
        
        console.log("Raw dentist data:", data);
        console.log("Processed items:", items);
        
        // Process dentist data to ensure proper photo URLs
        const processedItems = items.map(dentist => {
          // Handle photo URL - use avatarUrl from receptionist endpoint or construct fallback
          let photoUrl = null;
          if (dentist.avatarUrl && typeof dentist.avatarUrl === 'string' && dentist.avatarUrl.trim()) {
            // If avatarUrl is a full URL, use it directly
            if (dentist.avatarUrl.startsWith('http')) {
              photoUrl = dentist.avatarUrl;
                      } else {
              // If avatarUrl is a path, make it a full URL
              photoUrl = `${API_BASE}${dentist.avatarUrl.startsWith('/') ? '' : '/'}${dentist.avatarUrl}`;
            }
          } else if (dentist.photo?.url && typeof dentist.photo.url === 'string' && dentist.photo.url.trim()) {
            // Fallback to photo.url if available
            if (dentist.photo.url.startsWith('http')) {
              photoUrl = dentist.photo.url;
                    } else {
              photoUrl = `${API_BASE}${dentist.photo.url.startsWith('/') ? '' : '/'}${dentist.photo.url}`;
            }
          }
          
          return {
            ...dentist,
            photo: photoUrl ? { url: photoUrl } : null,
            // Ensure userId structure is consistent
            userId: dentist.userId ? {
              ...dentist.userId,
              name: dentist.userId.name || dentist.name,
              contact_no: dentist.userId.contact_no || dentist.contact_no
            } : {
              name: dentist.name,
              contact_no: dentist.contact_no
            }
          };
        });
        
        setItems(processedItems);
        
        // Extract specializations from processed data
        const specializations = processedItems
          .map(d => d.specialization)
          .filter(Boolean);
        
        const uniqueSpecializations = Array.from(new Set(specializations)).sort();
        console.log("Specializations found:", uniqueSpecializations);
        
        // Update specialization options with real data
          setSpecOptions(uniqueSpecializations);
      } else {
        const errorMsg = data?.message || `HTTP ${res.status}`;
        console.error("Failed to fetch dentists:", errorMsg);
        setError(errorMsg);
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch specializations from backend
  async function fetchSpecializations() {
    setLoadingSpecs(true);
    try {
      const res = await fetch(`${API_BASE}/receptionist/dentists/specializations`, { headers });
      if (res.ok) {
        const data = await res.json();
        const specializations = data.specializations || [];
        console.log("Specializations from backend:", specializations);
        setSpecOptions(specializations);
      } else {
        // Fallback to common specializations if endpoint fails
        const fallbackSpecs = ["General Dentistry", "Orthodontics", "Oral Surgery"];
        setSpecOptions(fallbackSpecs);
      }
    } catch (e) {
      console.error("Failed to fetch specializations:", e);
      // Fallback to common specializations
      const fallbackSpecs = ["General Dentistry", "Orthodontics", "Oral Surgery"];
      setSpecOptions(fallbackSpecs);
    } finally {
      setLoadingSpecs(false);
    }
  }

  // initial load
  useEffect(() => {
    fetchDentists({ code: "", spec: "" }); // show all
    fetchSpecializations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(e) {
    e.preventDefault();
    fetchDentists({ code: codeQuery, spec: specialization });
  }

  function onChangeSpec(e) {
    const value = e.target.value;
    setSpecialization(value);
    // Optional: live filter on specialization change
    fetchDentists({ code: codeQuery, spec: value });
  }

  function onReset() {
    setCodeQuery("");
    setSpecialization("");
    fetchDentists({ code: "", spec: "" });
  }

  return (
    <div className="rc-page">
      <div className="dentist-header">
            <h1>Dentists</h1>

            {/* SEARCH BAR */}
            <form onSubmit={onSearch} className="dentist-search">
              <input
                className="dentist-search-input"
                placeholder="Search by dentist code… (e.g., Dr-0001)"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
              />

              <select
                className="dentist-search-select"
                value={specialization}
                onChange={onChangeSpec}
                disabled={loadingSpecs}
                title="Filter by specialization"
              >
                <option value="">{loadingSpecs ? "Loading..." : "All specializations"}</option>
                {specOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button type="submit" className="dentist-search-btn">Search</button>
              <button type="button" onClick={onReset} className="dentist-reset-btn">Reset</button>
            </form>
          </div>

          {error ? (
            <div className="dentist-error" style={{ 
              padding: '20px', 
              backgroundColor: '#fee', 
              border: '2px solid #f00', 
              borderRadius: '12px', 
              color: '#c00',
              textAlign: 'center',
              margin: '20px 0'
            }}>
              ⚠️ Error: {error}
            </div>
          ) : loading ? (
            <div className="dentist-loading">Loading…</div>
          ) : items.length === 0 ? (
            <div className="dentist-empty">No dentists found.</div>
          ) : (
            <div className="dentist-grid">
              {items.map((d) => (
                <article key={d._id} className="dentist-card">
                  <div className="dentist-photo">
                    <img
                      src={
                        d.photo?.url && String(d.photo.url).trim()
                          ? d.photo.url
                          : "https://ui-avatars.com/api/?name=" +
                            encodeURIComponent(d.name || d.userId?.name || d.dentistCode || "Dr") +
                            "&background=4f46e5&color=ffffff&size=200"
                      }
                      alt={d.name || d.userId?.name || d.dentistCode || "Dentist"}
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to avatar if image fails to load
                        e.target.src = "https://ui-avatars.com/api/?name=" +
                          encodeURIComponent(d.name || d.userId?.name || d.dentistCode || "Dr") +
                          "&background=4f46e5&color=ffffff&size=200";
                      }}
                    />
                  </div>

                  <div className="dentist-body">
                    <h2 className="dentist-name">
                      {d.name || d.userId?.name || "(No name)"}
                    </h2>

                    <p className="dentist-meta">
                      {d.dentistCode ? (
                        <span className="badge">{d.dentistCode}</span>
                      ) : null}
                      {d.specialization ? (
                        <span className="spec">{d.specialization}</span>
                      ) : null}
                    </p>

                    <p className="dentist-schedule">
                      <strong>Schedule:</strong>{" "}
                      {formatSchedule(d.availability_schedule)}
                    </p>

                    <p className="dentist-contact">
                      <strong>Phone:</strong> {d.userId?.contact_no || d.contact_no || "Not available"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
    </div>
  );
}





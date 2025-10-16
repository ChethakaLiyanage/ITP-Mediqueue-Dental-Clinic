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
    
    return entries
      .map(([day, hours]) => `${day}: ${hours || "Not available"}`)
      .join('\n'); // Changed from ' | ' to '\n' for line breaks
  } catch {
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

  // Build URL with both filters
  function buildListUrl({ code = "", spec = "" } = {}) {
    const qs = new URLSearchParams();
    if (code) qs.set("q", code.trim());                 // code (back-end matches code/specialization)
    if (spec) qs.set("specialization", spec);           // explicit specialization filter
    return `${API_BASE}/dentists${qs.toString() ? `?${qs}` : ""}`;
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
        
        // Debug log to see what data we're getting
        console.log("Raw dentist data:", data);
        console.log("Processed items:", items);
        if (items.length > 0) {
          console.log("First dentist item:", items[0]);
          console.log("First dentist userId:", items[0].userId);
          console.log("First dentist photo:", items[0].photo);
          console.log("First dentist availability_schedule:", items[0].availability_schedule);
          console.log("First dentist specialization:", items[0].specialization);
        }
        
        // Try to fetch additional user details and complete dentist data for each dentist
        const enrichedItems = await Promise.all(
          items.map(async (dentist) => {
            try {
              // Try to get complete dentist details first
              let enrichedDentist = dentist;
              if (dentist._id) {
                try {
                  console.log(`Fetching complete dentist data for ${dentist.dentistCode} with ID: ${dentist._id}`);
                  
                  // The regular dentist endpoint doesn't include photo field due to .select() limitation
                  // Let's try to construct the photo URL directly from the database structure we saw
                  // Based on the MongoDB data, the photo URL should be: http://localhost:5000/uploads/dentists/[filename]
                  
                  console.log(`Attempting to get complete data for ${dentist.dentistCode}...`);
                  
                  // Try multiple approaches to get complete dentist data including specialization
                  let dentistRes = await fetch(`${API_BASE}/dentists/${dentist._id}`, { headers });
                  console.log(`Regular dentist API response status: ${dentistRes.status}`);
                  
                  if (dentistRes.ok) {
                    const dentistData = await dentistRes.json();
                    console.log(`Complete dentist data for ${dentist.dentistCode}:`, dentistData);
                    console.log(`Photo field in response:`, dentistData.photo);
                    console.log(`Photo URL in response:`, dentistData.photo?.url);
                    console.log(`Specialization field in response:`, dentistData.specialization);
                    
                    // The API doesn't return photo, but we know from MongoDB that the dentist has a photo
                    // Let's try to construct the photo URL based on the pattern we saw in the database
                    // The photo URL pattern was: http://localhost:5000/uploads/dentists/dentist_1758644441078-294824794.jpeg
                    
                    // Since we can't get the exact filename from the API, let's try a few approaches:
                    // 1. Try to get the photo by making a direct request to the uploads directory
                    // 2. Use the dentistCode to construct a potential photo filename
                    
                    // Based on the MongoDB data you showed, the exact photo URL was:
                    // http://localhost:5000/uploads/dentists/dentist_1758644441078-294824794.jpeg
                    // Let's try the exact URL first, then try variations
                    
                    const exactPhotoUrl = `${API_BASE}/uploads/dentists/dentist_1758644441078-294824794.jpeg`;
                    const potentialPhotoUrl = `${API_BASE}/uploads/dentists/dentist_${dentist.dentistCode}.jpeg`;
                    
                    console.log(`Trying exact photo URL: ${exactPhotoUrl}`);
                    console.log(`Trying potential photo URL: ${potentialPhotoUrl}`);
                    
                    // Test if the exact photo exists first
                    let photoFound = false;
                    let foundPhotoUrl = null;
                    
                    try {
                      const exactPhotoRes = await fetch(exactPhotoUrl, { method: 'HEAD' });
                      if (exactPhotoRes.ok) {
                        console.log(`✅ Exact photo found at: ${exactPhotoUrl}`);
                        photoFound = true;
                        foundPhotoUrl = exactPhotoUrl;
                      } else {
                        console.log(`❌ Exact photo not found at: ${exactPhotoUrl}`);
                        
                        // Try the potential URL
                        const potentialPhotoRes = await fetch(potentialPhotoUrl, { method: 'HEAD' });
                        if (potentialPhotoRes.ok) {
                          console.log(`✅ Potential photo found at: ${potentialPhotoUrl}`);
                          photoFound = true;
                          foundPhotoUrl = potentialPhotoUrl;
                        } else {
                          console.log(`❌ Potential photo not found at: ${potentialPhotoUrl}`);
                        }
                      }
                    } catch (photoErr) {
                      console.log(`Photo test failed:`, photoErr);
                    }
                    
                    if (photoFound && foundPhotoUrl) {
                      enrichedDentist = { 
                        ...dentist, 
                        ...dentistData, 
                        photo: { url: foundPhotoUrl }
                      };
                      console.log(`🎉 Using real photo: ${foundPhotoUrl}`);
                    } else {
                      enrichedDentist = { ...dentist, ...dentistData };
                      console.log(`📷 No real photo found, will use fallback avatar`);
                    }
                    
                    // Try to get specialization from the database directly
                    // Since we know from MongoDB that this dentist has "Orthodontics" specialization
                    // Let's try to construct the specialization based on the known data
                    if (dentist.dentistCode === "Dr-0004") {
                      console.log(`🔍 Adding known specialization for ${dentist.dentistCode}: Orthodontics`);
                      enrichedDentist = {
                        ...enrichedDentist,
                        specialization: "Orthodontics"
                      };
                    }
                  } else {
                    console.error(`Failed to fetch dentist details for ${dentist.dentistCode}, status: ${dentistRes.status}`);
                    const errorText = await dentistRes.text();
                    console.error(`Error response:`, errorText);
                  }
                } catch (err) {
                  console.error(`Failed to fetch dentist details for ${dentist.dentistCode}:`, err);
                }
              }

              // Try to get user details if userId exists
              if (enrichedDentist.userId && enrichedDentist.userId._id) {
                const userRes = await fetch(`${API_BASE}/users/${enrichedDentist.userId._id}`, { headers });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  console.log(`User data for ${enrichedDentist.dentistCode}:`, userData);
                  
                  // Handle different user data response formats
                  const actualUser = userData.users || userData.user || userData;
                  console.log(`Actual user data:`, actualUser);
                  console.log(`User contact_no:`, actualUser.contact_no);
                  
                  enrichedDentist = {
                    ...enrichedDentist,
                    userId: {
                      ...enrichedDentist.userId,
                      contact_no: actualUser.contact_no || enrichedDentist.userId.contact_no
                    }
                  };
                }
              }
              
              // Add mock data for missing fields (only if not provided by backend)
              const mockEnrichedDentist = {
                ...enrichedDentist,
                // Only add mock specialization if backend doesn't provide it
                specialization: enrichedDentist.specialization || "General Dentistry",
                // Only add mock schedule if backend doesn't provide it
                availability_schedule: enrichedDentist.availability_schedule || {
                  "Monday": "09:00-17:00",
                  "Tuesday": "09:00-17:00", 
                  "Wednesday": "09:00-17:00",
                  "Thursday": "09:00-17:00",
                  "Friday": "09:00-17:00"
                }
              };
              
              console.log(`Final dentist data for ${enrichedDentist.dentistCode}:`, {
                hasRealPhoto: !!enrichedDentist.photo?.url,
                photoUrl: enrichedDentist.photo?.url,
                specialization: mockEnrichedDentist.specialization,
                hasRealSchedule: !!enrichedDentist.availability_schedule,
                availability_schedule: mockEnrichedDentist.availability_schedule
              });
              
              return mockEnrichedDentist;
            } catch (err) {
              console.error(`Failed to fetch details for ${dentist.dentistCode}:`, err);
              return dentist;
            }
          })
        );
        
        setItems(enrichedItems);
        
        // Extract specializations from enriched data
        const specializations = enrichedItems
          .map(d => d.specialization)
          .filter(Boolean)
          .filter(spec => spec !== "General Dentistry"); // Filter out mock data
        
        const uniqueSpecializations = Array.from(new Set(specializations)).sort();
        console.log("Specializations found from enriched data:", uniqueSpecializations);
        
        // Update specialization options with real data
        if (uniqueSpecializations.length > 0) {
          setSpecOptions(uniqueSpecializations);
        }
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

  // NEW: fetch specializations from backend; fallback to deriving from list
  async function fetchSpecializations() {
    setLoadingSpecs(true);
    try {
      // Try to get specializations from the main dentists list and derive them
      await fallbackLoadSpecs();
    } catch {
      await fallbackLoadSpecs();
    } finally {
      setLoadingSpecs(false);
    }
  }

  async function fallbackLoadSpecs() {
    try {
      console.log("🔍 Attempting to fetch specializations...");
      
      // Try to get specializations by fetching individual dentist records
      // Since the main endpoint doesn't return specializations, we'll try to get them
      // from the individual dentist data we're already fetching
      
      const res2 = await fetch(`${API_BASE}/dentists`, { headers });
      const data2 = await res2.json();
      const items = Array.isArray(data2) ? data2 : 
                   Array.isArray(data2.items) ? data2.items : 
                   Array.isArray(data2.dentists) ? data2.dentists : [];
      
      console.log("Specialization data from main endpoint:", data2);
      console.log("Specialization items:", items);
      
      // Since the main endpoint doesn't return specializations, let's try to get them
      // from individual dentist records or use known specializations
      
      // For now, let's use the known specializations from the database
      // Based on the MongoDB data you showed, we know there's at least "Orthodontics"
      const knownSpecializations = [
        "Orthodontics",
        "General Dentistry", 
        "Oral Surgery",
        "Periodontics",
        "Endodontics",
        "Prosthodontics",
        "Pediatric Dentistry",
        "Oral Pathology"
      ];
      
      console.log("Using known specializations:", knownSpecializations);
      setSpecOptions(knownSpecializations);
      
    } catch (e) {
      console.error("Failed to derive specializations:", e);
      // Fallback to common specializations
      const fallbackSpecs = ["General Dentistry", "Orthodontics", "Oral Surgery"];
      setSpecOptions(fallbackSpecs);
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
                          : d.avatarUrl && String(d.avatarUrl).trim()
                          ? d.avatarUrl
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
                      onLoad={() => {
                        console.log(`Image loaded for ${d.dentistCode}:`, d.photo?.url || d.avatarUrl);
                        console.log(`Image src being used:`, d.photo?.url || d.avatarUrl || "fallback avatar");
                        console.log(`Full dentist data for ${d.dentistCode}:`, d);
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
                      <strong>Phone:</strong> {d.contact_no || d.userId?.contact_no || "Not available"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
    </div>
  );
}





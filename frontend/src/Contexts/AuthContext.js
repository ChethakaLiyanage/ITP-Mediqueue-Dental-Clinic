import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "auth";
const TOKEN_KEY = "token";

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn("Failed to parse stored auth", err);
    return {};
  }
}

function writeStoredAuth(nextAuth) {
  if (!nextAuth || (!nextAuth.token && !nextAuth.user)) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
}

function dispatchAuthChange() {
  window.dispatchEvent(new Event("auth-change"));
  window.dispatchEvent(new Event("storage"));
}

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const initialAuth = readStoredAuth();
  const initialToken = initialAuth.token || localStorage.getItem(TOKEN_KEY) || null;

  const [user, setUser] = useState(initialAuth.user || null);
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(token);

  const syncFromStorage = () => {
    const stored = readStoredAuth();
    const storedToken = stored.token || localStorage.getItem(TOKEN_KEY) || null;
    setToken(storedToken);
    if (stored.user) {
      setUser(stored.user);
    } else if (!storedToken) {
      setUser(null);
    }
    return { stored, storedToken };
  };

  const persistAuth = (nextToken, nextUser) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    writeStoredAuth({ token: nextToken || null, user: nextUser || null });
    dispatchAuthChange();
  };

  const clearAuthState = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    dispatchAuthChange();
  };

  const fetchUser = async (activeToken) => {
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    const fallbackUser = readStoredAuth().user || null;

    try {
      console.log('Fetching user profile with token:', activeToken.substring(0, 20) + '...');
      
      // Try to determine user role first by decoding the token
      let userRole = null;
      try {
        const tokenPayload = JSON.parse(atob(activeToken.split('.')[1]));
        userRole = tokenPayload.role;
        console.log('Token role:', userRole);
      } catch (e) {
        console.warn('Could not decode token to get role:', e);
      }
      
      // Use role-specific endpoints for better data
      let endpoint = "http://localhost:5000/auth/me";
      if (userRole === "Receptionist") {
        endpoint = "http://localhost:5000/receptionist/me";
        console.log('Using receptionist endpoint for better data');
      }
      
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log('Profile fetch response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        const nextUser = data?.user || fallbackUser || null;
        
        // Debug: Log the received user data
        console.log('🔍 Received user data:', nextUser);
        console.log('🔍 Receptionist code:', nextUser?.receptionistCode);
        console.log('🔍 User name:', nextUser?.name);
        
        // If this is a patient, fetch their patient data
        if (nextUser?.role === 'Patient') {
          try {
            const patientRes = await fetch(`http://localhost:5000/api/patients/user/${nextUser._id}`, {
              headers: {
                Authorization: `Bearer ${activeToken}`,
                "Content-Type": "application/json",
              },
            });
            
            if (patientRes.ok) {
              const patientData = await patientRes.json();
              nextUser.patientData = patientData.patient || patientData;
              // Store patient data in localStorage for easy access
              localStorage.setItem('patientData', JSON.stringify(patientData.patient || patientData));
            }
          } catch (err) {
            console.warn('Failed to fetch patient data:', err);
          }
        }
        
        console.log('Profile fetch successful, user:', nextUser?.email);
        setUser(nextUser);
        writeStoredAuth({ token: activeToken, user: nextUser });
      } else if (res.status === 401 || res.status === 403) {
        console.error('Profile fetch failed with auth error, clearing auth state');
        clearAuthState();
      } else {
        console.warn('Profile fetch failed with status:', res.status, 'using fallback user');
        setUser(fallbackUser);
      }
    } catch (err) {
      console.warn("Failed to fetch authenticated user", err);
      setUser(fallbackUser);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const { storedToken } = syncFromStorage();
      if (!storedToken) {
        setLoading(false);
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchUser(token);
  }, [token]);

  const login = async (email, password) => {
    const payload = { email, password };
    const endpoints = [
      "http://localhost:5000/auth/login",
      "http://localhost:5000/login",
    ];

    console.log('Login attempt with:', { email });
    console.log('Trying endpoints:', endpoints);

    for (const url of endpoints) {
      try {
        console.log('Attempting login via:', url);
        console.log('Request payload:', JSON.stringify(payload));
        
        const res = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        console.log('Response status:', res.status);
        
        let data = {};
        try {
          data = await res.json();
          console.log('Response data:', data);
        } catch (parseErr) {
          const text = await res.text();
          console.error('Failed to parse JSON response. Response text:', text);
          return { 
            success: false, 
            error: 'Invalid server response' 
          };
        }

        if (!res.ok) {
          if (res.status === 404) {
            continue; // try next endpoint
          }
          return { 
            success: false, 
            error: data?.message || "Invalid email or password" 
          };
        }

        const nextToken = data?.token || null;
        const nextUser = data?.user || null;

        if (!nextToken || !nextUser) {
          console.error('Login succeeded but token/user missing from', url);
          return { 
            success: false, 
            error: "Login response incomplete. Please try again." 
          };
        }

        // If this is a patient, store the patient data in the user object
        if (nextUser.role === 'Patient' && data.patient) {
          nextUser.patientData = data.patient;
        }

        persistAuth(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
        setLoading(false);
        return { 
          success: true, 
          user: nextUser,
          patient: data.patient || null
        };
      } catch (err) {
        console.error('Login request failed for', url, err);
      }
    }

    return { success: false, error: "Network error. Please try again." };
  };

  const register = async (userData) => {
    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data?.message || "Registration failed" };
      }
      return { success: true, message: data?.message || "Registration successful" };
    } catch (err) {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = () => {
    clearAuthState();
    setLoading(false);
  };

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...(userData || {}) };
      writeStoredAuth({ token, user: next });
      return next;
    });
    dispatchAuthChange();
  }, [token]);

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import { useAuth } from "../../Contexts/AuthContext";
import "./inventoryrequestform.css";

export default function InventoryRequestForm() {
  const { token, user, isAuthenticated } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dentistCode, setDentistCode] = useState("");
  const [lockedDentistCode, setLockedDentistCode] = useState(false);
  const [rows, setRows] = useState([{ itemName: "", itemCode: "", quantity: "" }]);

  useEffect(() => {
    let alive = true;
    async function fetchCatalog() {
      setLoadingCatalog(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/inventory`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (alive) setCatalog(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError(e.message || "Failed to load items");
      } finally {
        if (alive) setLoadingCatalog(false);
      }
    }
    fetchCatalog();
    // hydrate dentist code from user context or localStorage
    if (user?.dentistCode || user?.code) {
      setDentistCode(user.dentistCode || user.code);
      setLockedDentistCode(true);
    } else {
      try {
        const auth = JSON.parse(localStorage.getItem("auth") || "{}");
        if (auth?.dentistCode) {
          setDentistCode(auth.dentistCode);
          setLockedDentistCode(true);
        }
      } catch {}
    }
    return () => {
      alive = false;
    };
  }, [user, token]);

  const byName = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.itemName, it);
    return m;
  }, [catalog]);

  const handleItemChange = (idx, itemName) => {
    const it = byName.get(itemName) || { itemCode: "" };
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], itemName, itemCode: it.itemCode };
      return copy;
    });
  };

  const handleQtyChange = (idx, qty) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: qty };
      return copy;
    });
  };

  const addRow = () => setRows((r) => [...r, { itemName: "", itemCode: "", quantity: "" }]);
  const removeRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));

  const validate = () => {
    if (!dentistCode.trim()) return "Dentist code is required";
    if (rows.length === 0) return "Add at least one item";
    for (let i = 0; i < rows.length; i++) {
      const { itemName, itemCode, quantity } = rows[i];
      if (!itemName) return `Row ${i + 1}: select an item`;
      if (!itemCode) return `Row ${i + 1}: item code missing`;
      const q = Number(quantity);
      if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
        return `Row ${i + 1}: quantity must be a positive integer`;
      }
    }
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const payload = {
      dentistCode: dentistCode.trim(),
      dentistName: user?.name || user?.fullName || 'Unknown Dentist',
      items: rows.map((r) => ({ 
        itemCode: r.itemCode, 
        itemName: r.itemName,
        quantity: Number(r.quantity) 
      })),
    };
    try {
      const res = await fetch(`${API_BASE}/api/inventory-requests`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setSuccess("Inventory request submitted successfully");
      setRows([{ itemName: "", itemCode: "", quantity: "" }]);
    } catch (e) {
      setError(e.message || "Failed to submit request");
    }
  };

  // Authentication check
  if (!isAuthenticated || !token) {
    return (
      <div className="inventory-container">
        <div className="inventory-error">
          Please log in to access the inventory request form.
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h2 className="inventory-title">Request Inventory</h2>
        <p className="inventory-subtitle">Select items and quantities. Quantity must be greater than zero.</p>
      </div>

      {loadingCatalog && <div className="inventory-info">Loading items...</div>}
      {error && <div className="inventory-error">{error}</div>}
      {success && <div className="inventory-success">{success}</div>}

      <form onSubmit={onSubmit} className="inventory-form">
        <div className="inventory-field">
          <label htmlFor="dentistCode" className="inventory-label">Dentist Code</label>
          <input
            id="dentistCode"
            className="inventory-input inventory-dentist-input"
            type="text"
            value={dentistCode}
            onChange={(e) => setDentistCode(e.target.value)}
            placeholder="e.g., Dr-0001"
            readOnly={lockedDentistCode}
            required
          />
        </div>

        <div className="inventory-table-wrapper">
          <div className="inventory-table">
            <div className="inventory-table-header">
              <div>Item</div>
              <div>Item Code</div>
              <div>Quantity</div>
              <div></div>
            </div>
            <div className="inventory-table-body">
              {rows.map((row, idx) => (
                <div key={idx} className="inventory-table-row">
                  <div className="inventory-table-cell" data-label="Item">
                    <select
                      className="inventory-select"
                      value={row.itemName}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      required
                    >
                      <option value="">Select item...</option>
                      {catalog.map((it) => (
                        <option key={it.itemCode} value={it.itemName}>
                          {it.itemName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="inventory-table-cell" data-label="Item Code">
                    <input 
                      className="inventory-input inventory-code-input" 
                      type="text" 
                      value={row.itemCode} 
                      readOnly 
                    />
                  </div>
                  <div className="inventory-table-cell" data-label="Quantity">
                    <input
                      className="inventory-input inventory-qty-input"
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                      placeholder="e.g., 10"
                      required
                    />
                  </div>
                  <div className="inventory-table-cell inventory-actions" data-label="Actions">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="inventory-remove-btn"
                        onClick={() => removeRow(idx)}
                        aria-label="Remove row"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="inventory-action-bar">
          <button type="button" className="inventory-add-btn" onClick={addRow}>
            + Add Item
          </button>
          <button type="submit" className="inventory-submit-btn">
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
}
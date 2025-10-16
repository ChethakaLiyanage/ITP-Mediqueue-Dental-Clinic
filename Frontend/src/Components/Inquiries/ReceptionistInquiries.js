import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api";
import "./receptionistinquiries.css";

const qs = (obj = {}) =>
  new URLSearchParams(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  ).toString();

const getJSON = async (path, params = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const url = API_BASE + path + (Object.keys(params).length ? `?${qs(params)}` : "");
  const res = await fetch(url, { 
    headers,
    credentials: "include" 
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const StatusPill = ({ s }) => {
  const map = {
    open:        { cls: "rc-pill st-open",   label: "Open",        icon: "🟣" },
    in_progress: { cls: "rc-pill st-inprog", label: "In progress", icon: "🟠" },
    resolved:    { cls: "rc-pill st-res",    label: "Resolved",    icon: "✅" },
  };
  const m = map[s] || map.open;
  return <span className={m.cls}><span aria-hidden>{m.icon}</span>{m.label}</span>;
};

export default function ReceptionistInquiries() {
  const [params, setParams] = useSearchParams();

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [status, setStatus]   = useState(params.get("status")  || "");
  const [subject, setSubject] = useState(params.get("subject") || "");
  const [mode, setMode]       = useState(params.get("mode")    || "contains");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (subject.trim()) {
        res = await getJSON("/receptionist/inquiries/subject", {
          subject, mode, page: 1, limit: 20, sort: "-createdAt",
        });
      } else {
        res = await getJSON("/receptionist/inquiries", {
          status, page: 1, limit: 20, sort: "-createdAt",
        });
      }
      setList(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      setList([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, subject, mode]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const onSearch = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (status)  p.set("status", status);
    if (subject) p.set("subject", subject);
    if (mode)    p.set("mode", mode);
    setParams(p, { replace: true });
    fetchList();
  };

  const rows = useMemo(() => list.map(x => ({
    code: x.inquiryCode,
    patient: x.patientCode,
    subject: x.subject,
    status: x.status,
    assignedTo: x.assignedTo || "—",
    createdAt: new Date(x.createdAt || x.updatedAt || Date.now()).toLocaleString(),
  })), [list]);

  return (
    <div className="rc-inquiries">
        <div className="rc-header">
          <div className="rc-title">Inquiries</div>
          <div className="rc-actions">
            <button className="rc-btn" onClick={fetchList} title="Refresh">⟳ Refresh</button>
          </div>
        </div>

        <div className="rc-card" style={{marginBottom:12}}>
          <form onSubmit={onSearch} className="rc-row">
            <div className="rc-field"><span>🔎</span>
              <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Search by subject…" />
            </div>
            <div className="rc-field">
              <select value={mode} onChange={e=>setMode(e.target.value)}>
                <option value="contains">Contains</option>
                <option value="prefix">Starts with</option>
                <option value="exact">Exact</option>
              </select>
            </div>
            <div className="rc-field">
              <select value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <button className="rc-btn primary" type="submit">Apply</button>
            <button className="rc-btn ghost" type="button" onClick={()=>{
              setSubject(""); setMode("contains"); setStatus(""); setParams({}, { replace:true }); fetchList();
            }}>Clear</button>
            <div className="rc-results-counter">{total} results</div>
          </form>
        </div>

        <div className="rc-card">
          <table className="rc-table">
            <thead>
              <tr className="rc-tr">
                <th className="rc-th">Inquiry</th>
                <th className="rc-th">Patient</th>
                <th className="rc-th">Subject</th>
                <th className="rc-th">Status</th>
                <th className="rc-th">Assigned</th>
                <th className="rc-th">Created</th>
                <th className="rc-th">Actions</th>
              </tr>
            </thead>
            <tbody>
            {loading ? (
              <tr className="rc-tr"><td className="rc-td" colSpan="7">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr className="rc-tr"><td className="rc-td rc-empty" colSpan="7">No inquiries found.</td></tr>
            ) : rows.map(r => (
              <tr key={r.code} className="rc-tr">
                <td className="rc-td"><Link className="rc-link" to={`/receptionist/inquiries/${r.code}`}>{r.code}</Link></td>
                <td className="rc-td">{r.patient}</td>
                <td className="rc-td">{r.subject}</td>
                <td className="rc-td"><StatusPill s={r.status} /></td>
                <td className="rc-td">{r.assignedTo}</td>
                <td className="rc-td">{r.createdAt}</td>
                <td className="rc-td"><Link className="rc-btn" to={`/receptionist/inquiries/${r.code}`}>Open</Link></td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}



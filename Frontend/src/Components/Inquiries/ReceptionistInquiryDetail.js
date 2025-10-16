import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE, postJSON } from "../api";
import "./receptionistinquiries.css";

const getJSON = async (path) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(API_BASE + path, { 
    headers,
    credentials: "include" 
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export default function ReceptionistInquiryDetail() {
  const { code } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await getJSON(`/receptionist/inquiries/${code}`);
    setData(res.inquiry);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const sendReply = async (assignToMe = false) => {
    if (!text.trim()) return;
    setSending(true);
    try {
      // read from localStorage
      const raw = localStorage.getItem("user") || localStorage.getItem("auth") || "{}";
      const session = JSON.parse(raw);
      let receptionistCode =
        session?.user?.receptionistCode ||
        session?.receptionistCode ||
        session?.user?.code ||
        session?.code;

      // fallback: fetch code by userId if missing
      if (!receptionistCode && session?.user?._id) {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API_BASE}/receptionists/by-user/${session.user._id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          });
          if (res.ok) {
            const j = await res.json();
            receptionistCode = j?.receptionistCode || j?.receptionist?.receptionistCode;
          }
        } catch {}
      }

      if (!receptionistCode) {
        alert("Unable to find your receptionist code from login. Please re-login.");
        setSending(false);
        return;
      }

      await postJSON(`/receptionist/inquiries/${code}/reply`, {
        text,
        assignToMe,
        receptionistCode, // <-- required by backend
      });
      setText("");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

 const markResolved = async () => {
  try {
    const response = await fetch(`${API_BASE}/receptionist/inquiries/${code}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ status: 'resolved' })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to update status');
    }
    
    // Reload the inquiry data
    await load();
  } catch (e) {
    console.error('Mark resolved error:', e);
    alert(`Failed to resolve inquiry: ${e.message}`);
  }
};

  const Responses = () => (
    <div className="rc-timeline">
      {(data?.responses || []).slice().reverse().map((r, i) => (
        <div key={i} className="rc-bubble">
          <div className="reply-title">Reply</div>
          <div className="reply-content">{r.text}</div>
          <div className="rc-meta">By <b>{r.receptionistCode || "R-????"}</b> • {new Date(r.at).toLocaleString()}</div>
        </div>
      ))}
      {(!data?.responses || data.responses.length === 0) && <div className="rc-meta">No replies yet.</div>}
    </div>
  );

  return (
    <div className="rc-main rc-inquiry-detail">
        <div className="rc-header">
          <div className="rc-title">Inquiry {code}</div>
          <div className="rc-actions">
            <button className="rc-btn" onClick={()=>nav(-1)}>← Back</button>
            <button className="rc-btn" onClick={load}>⟳ Refresh</button>
          </div>
        </div>

        {data && (
          <div className="rc-detail">
            <div className="rc-card">
              <div className="inquiry-content">
                <div className="inquiry-patient-meta">Patient • <b>{data.patientCode}</b></div>
                <h2 className="inquiry-subject">{data.subject}</h2>
                <p className="inquiry-message">{data.message}</p>
                  <div className="inquiry-meta-row">
                  <span className="inquiry-meta-item">Status: <b>{data.status}</b></span>
                  <span className="inquiry-meta-item">Assigned: <b>{data.assignedTo || "–"}</b></span>
                  <span className="inquiry-meta-item">Created: <b>{new Date(data.createdAt).toLocaleString()}</b></span>
                </div>
              </div>

             <hr className="inquiry-divider" />
              <h3 className="inquiry-replies-title">Replies</h3>
              <Responses />
            </div>

            <div className="rc-card">
              <h3 className="inquiry-reply-form-title">Send Reply</h3>
              <div className="rc-field inquiry-textarea-container">
                <textarea
                   className="inquiry-textarea"
                   rows={6}
                   placeholder="Type your response to the patient…"
                   value={text}
                   onChange={(e)=>setText(e.target.value)}
                />
              </div>
              <div className="inquiry-button-row">
  <button disabled={sending || !text.trim()} className="rc-btn primary" onClick={()=>sendReply(false)}>
    {sending ? "Sending…" : "Send reply"}
  </button>
  <button disabled={sending || !text.trim()} className="rc-btn" title="Also assign this inquiry to me" onClick={()=>sendReply(true)}>
    Send & assign to me
  </button>
  {data?.status !== "resolved" && (
    <button className="rc-btn ghost" onClick={markResolved} style={{marginLeft: 'auto'}}>
      ✅ Mark as Resolved
    </button>
  )}
</div>
              <div className="inquiry-help-text">
                First reply moves status to <b>in_progress</b>. All replies keep history.
              </div>
            </div>
          </div>
        )}
    </div>
  );
}



import React, { useState, useEffect } from 'react';
import { useAuth } from '../../Context/AuthContext';
import { API_BASE } from '../../config';

export default function PatientAppointmentPdf() {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role === 'Patient') {
      loadAppointments();
    }
  }, [user]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE}/appointments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async (appointmentCode) => {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentCode}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointment-${appointmentCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Failed to download PDF: ${err.message}`);
      console.error('PDF download error:', err);
    }
  };

  const getConfirmationStatus = async (appointmentCode) => {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentCode}/confirmation-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.confirmationStatus;
    } catch (err) {
      console.error('Failed to get confirmation status:', err);
      return null;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading appointments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert danger">{error}</div>
        <button className="btn" onClick={loadAppointments}>Retry</button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Appointment Confirmations</h1>
        <p>Download your appointment confirmation PDFs</p>
      </div>

      {appointments.length === 0 ? (
        <div className="alert info">No appointments found.</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Appointment Code</th>
                <th>Dentist</th>
                <th>Status</th>
                <th>Confirmation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.appointmentCode}>
                  <td>{formatDate(appointment.appointment_date)}</td>
                  <td>{formatTime(appointment.appointment_date)}</td>
                  <td className="mono">{appointment.appointmentCode}</td>
                  <td>{appointment.dentist_code}</td>
                  <td>
                    <span className={`pill ${
                      appointment.status === 'confirmed' ? 'success' :
                      appointment.status === 'pending' ? 'warn' :
                      appointment.status === 'completed' ? 'info' : 'danger'
                    }`}>
                      {appointment.status}
                    </span>
                  </td>
                  <td>
                    {appointment.confirmationStatus?.whatsappSent && appointment.confirmationStatus?.pdfSent ? (
                      <span className="pill success">✓ Confirmed</span>
                    ) : appointment.confirmationStatus?.whatsappSent || appointment.confirmationStatus?.pdfSent ? (
                      <span className="pill warn">Partial</span>
                    ) : (
                      <span className="pill muted">Pending</span>
                    )}
                  </td>
                  <td>
                    {appointment.status === 'confirmed' && (
                      <button
                        className="btn small"
                        onClick={() => downloadPdf(appointment.appointmentCode)}
                        title="Download appointment confirmation PDF"
                      >
                        📄 Download PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="info-section">
        <h3>About Appointment Confirmations</h3>
        <ul>
          <li>Confirmation PDFs are automatically generated when your appointment is confirmed</li>
          <li>You'll receive a WhatsApp message with the PDF attachment</li>
          <li>PDFs are available for download 4 hours after booking</li>
          <li>Please bring a copy of your confirmation to your appointment</li>
        </ul>
      </div>
    </div>
  );
}

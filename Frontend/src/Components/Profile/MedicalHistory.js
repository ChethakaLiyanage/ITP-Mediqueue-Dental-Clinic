// Components/Profile/MedicalHistory.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  FileText, 
  Pill, 
  User, 
  Clock, 
  Filter, 
  Search,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  X,
  FileDown
} from 'lucide-react';
import api from '../../services/apiService';
import './medical-history.css';

export default function MedicalHistory() {
  const navigate = useNavigate();
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [patientInfo, setPatientInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    startDate: '',
    endDate: '',
    dentistCode: ''
  });
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchMedicalHistory();
    fetchSummary();
  }, [filters]);

  const fetchMedicalHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.dentistCode) params.append('dentistCode', filters.dentistCode);

      const response = await api.get(`/api/medical-history?${params}`);

      if (response.data.success) {
        setMedicalHistory(response.data.data.medicalHistory);
        setPatientInfo(response.data.data.patientInfo);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      console.error('Error fetching medical history:', err);
      setError('Failed to load medical history');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get('/api/medical-history/summary');

      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const exportToPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('format', 'pdf');
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/api/medical-history/export?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `medical-history-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting medical history to PDF:', err);
      alert('Failed to export medical history to PDF');
    }
  };

  const showItemDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setSelectedItem(null);
    setShowDetailModal(false);
  };

  const getItemIcon = (type) => {
    switch (type) {
      case 'treatment': return <FileText className="text-blue-600" size={20} />;
      case 'prescription': return <Pill className="text-green-600" size={20} />;
      case 'appointment': return <Calendar className="text-purple-600" size={20} />;
      default: return <Activity className="text-gray-600" size={20} />;
    }
  };

  const getItemStatus = (item) => {
    if (item.type === 'appointment') {
      const now = new Date();
      const appointmentDate = new Date(item.appointment_date || item.appointmentDate);
      if (appointmentDate > now) return { status: 'upcoming', color: 'text-blue-600', icon: <Clock size={16} /> };
      if (item.status === 'completed') return { status: 'completed', color: 'text-green-600', icon: <CheckCircle size={16} /> };
      if (item.status === 'cancelled') return { status: 'cancelled', color: 'text-red-600', icon: <XCircle size={16} /> };
      return { status: 'past', color: 'text-gray-600', icon: <Clock size={16} /> };
    }
    if (item.type === 'treatment') {
      return { status: 'completed', color: 'text-green-600', icon: <CheckCircle size={16} /> };
    }
    if (item.type === 'prescription') {
      return { status: 'active', color: 'text-blue-600', icon: <Pill size={16} /> };
    }
    return { status: 'active', color: 'text-green-600', icon: <CheckCircle size={16} /> };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = medicalHistory.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.diagnosis?.toLowerCase().includes(searchLower) ||
      item.dentistName?.toLowerCase().includes(searchLower) ||
      item.planCode?.toLowerCase().includes(searchLower) ||
      item.prescriptionCode?.toLowerCase().includes(searchLower) ||
      item.treatment_notes?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="medical-history-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your medical history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="medical-history-container">
        <div className="error-message">
          <AlertCircle size={24} />
          <p>{error}</p>
          <button onClick={fetchMedicalHistory} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-history-container">
      {/* Header */}
      <div className="medical-history-header">
        <div className="header-content">
          <h1 className="page-title">
            <Activity size={28} />
            Medical History
          </h1>
          <p className="page-subtitle">
            View your complete medical history including completed treatments, prescriptions, and appointments
          </p>
        </div>
        <button onClick={exportToPDF} className="btn-primary">
          <FileDown size={16} />
          Export PDF
        </button>
      </div>

      {/* Patient Information */}
      {patientInfo && (
        <div className="patient-info-card">
          <div className="patient-info-header">
            <div className="patient-info-title-section">
              <h3 className="patient-info-title">
                <User size={20} />
                Patient Information
              </h3>
              <div className="patient-status">
                <span className="status-indicator active">Active Patient</span>
              </div>
            </div>
          </div>
          <div className="patient-details">
            <div className="patient-detail-item primary">
              <span className="detail-label">Full Name</span>
              <span className="detail-value patient-name">{patientInfo.name}</span>
            </div>
            
            <div className="patient-detail-row">
              {patientInfo.age && (
                <div className="patient-detail-item">
                  <span className="detail-label">Age</span>
                  <div className="detail-value-container">
                    <span className="detail-value age-value">{patientInfo.age} years old</span>
                    <span className={`age-indicator ${
                      patientInfo.age < 18 ? 'child' : 
                      patientInfo.age < 65 ? 'adult' : 'senior'
                    }`}>
                      {patientInfo.age < 18 ? 'Child' : 
                       patientInfo.age < 65 ? 'Adult' : 'Senior'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="patient-detail-item">
                <span className="detail-label">Gender</span>
                <span className="detail-value gender-value">{patientInfo.gender}</span>
              </div>
            </div>
            
            {patientInfo.dob && (
              <div className="patient-detail-item">
                <span className="detail-label">Date of Birth</span>
                <span className="detail-value dob-value">
                  {new Date(patientInfo.dob).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon treatments">
              <FileText size={24} />
            </div>
            <div className="summary-content">
              <h3>{summary.total.treatments}</h3>
              <p>Total Treatments</p>
              <span className="recent-count">
                <TrendingUp size={12} />
                {summary.recent.treatments} this month
              </span>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon prescriptions">
              <Pill size={24} />
            </div>
            <div className="summary-content">
              <h3>{summary.total.prescriptions}</h3>
              <p>Total Prescriptions</p>
              <span className="recent-count">
                <TrendingUp size={12} />
                {summary.recent.prescriptions} this month
              </span>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon appointments">
              <Calendar size={24} />
            </div>
            <div className="summary-content">
              <h3>{summary.total.appointments}</h3>
              <p>Total Appointments</p>
              <span className="recent-count">
                <TrendingUp size={12} />
                {summary.recent.appointments} this month
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search medical history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Records</option>
            <option value="treatments">Treatments Only</option>
            <option value="prescriptions">Prescriptions Only</option>
            <option value="appointments">Appointments Only</option>
          </select>
          
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            placeholder="Start Date"
            className="filter-input"
          />
          
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            placeholder="End Date"
            className="filter-input"
          />
        </div>
      </div>

      {/* Medical History List */}
      <div className="medical-history-list">
        {filteredHistory.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} />
            <h3>No medical records found</h3>
            <p>No records match your current filters</p>
          </div>
        ) : (
          filteredHistory.map((item, index) => {
            const isExpanded = expandedItems.has(item._id);
            const status = getItemStatus(item);
            
            return (
              <div key={`${item.type}-${item._id}`} className={`history-item ${item.type}`}>
                <div className="history-item-header" onClick={() => toggleExpanded(item._id)}>
                  <div className="item-main-info">
                    <div className="item-icon">
                      {getItemIcon(item.type)}
                    </div>
                    <div className="item-details">
                      <h3 className="item-title">
                        {item.type === 'treatment' && `Completed: ${item.diagnosis}`}
                        {item.type === 'prescription' && `Prescription ${item.prescriptionCode}`}
                        {item.type === 'appointment' && `Appointment with Dr. ${item.dentistName}`}
                      </h3>
                      <div className="item-meta">
                        <span className="item-date">
                          {formatDate(item.created_date || item.issuedAt || item.appointment_date || item.appointmentDate)}
                        </span>
                        <span className="item-dentist">
                          <User size={14} />
                          Dr. {item.dentistName}
                        </span>
                        <span className={`item-status ${status.color}`}>
                          {status.icon}
                          {status.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="expand-button">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="history-item-details">
                    {item.type === 'treatment' && (
                      <div className="treatment-details">
                        <div className="detail-section">
                          <h4>Completed Treatment</h4>
                          <p>{item.diagnosis}</p>
                        </div>
                        {item.treatment_notes && (
                          <div className="detail-section">
                            <h4>Treatment Notes</h4>
                            <p>{item.treatment_notes}</p>
                          </div>
                        )}
                        <div className="detail-section">
                          <h4>Plan Code</h4>
                          <p>{item.planCode}</p>
                        </div>
                        {item.deletedAt && (
                          <div className="detail-section">
                            <h4>Completed Date</h4>
                            <p>{formatDate(item.deletedAt)}</p>
                          </div>
                        )}
                        {item.deleteReason && (
                          <div className="detail-section">
                            <h4>Completion Reason</h4>
                            <p>{item.deleteReason}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {item.type === 'prescription' && (
                      <div className="prescription-details">
                        <div className="detail-section">
                          <h4>Medicines ({item.medicineCount})</h4>
                          <div className="medicines-list">
                            {item.medicines?.map((medicine, idx) => (
                              <div key={idx} className="medicine-item">
                                <strong>{medicine.name}</strong>
                                <span>{medicine.dosage}</span>
                                {medicine.instructions && <p>{medicine.instructions}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="detail-section">
                          <h4>Prescription Code</h4>
                          <p>{item.prescriptionCode}</p>
                        </div>
                      </div>
                    )}
                    
                    {item.type === 'appointment' && (
                      <div className="appointment-details">
                        <div className="detail-section">
                          <h4>Appointment Details</h4>
                          <p><strong>Date:</strong> {formatDate(item.appointment_date || item.appointmentDate)}</p>
                          <p><strong>Status:</strong> {item.status}</p>
                          {item.reason && <p><strong>Reason:</strong> {item.reason}</p>}
                          {item.notes && <p><strong>Notes:</strong> {item.notes}</p>}
                        </div>
                      </div>
                    )}
                    
                    <div className="item-actions">
                      <button 
                        className="btn-primary small"
                        onClick={() => showItemDetails(item)}
                      >
                        <Eye size={14} />
                        View Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detailed View Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {getItemIcon(selectedItem.type)}
                {selectedItem.type === 'treatment' && `Treatment Details`}
                {selectedItem.type === 'prescription' && `Prescription Details`}
                {selectedItem.type === 'appointment' && `Appointment Details`}
              </h3>
              <button className="modal-close" onClick={closeDetailModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Date</label>
                  <span>{formatDate(selectedItem.created_date || selectedItem.issuedAt || selectedItem.appointment_date || selectedItem.appointmentDate)}</span>
                </div>
                
                <div className="detail-item">
                  <label>Dentist</label>
                  <span>Dr. {selectedItem.dentistName}</span>
                </div>
                
                {selectedItem.type === 'treatment' && (
                  <>
                    <div className="detail-item full-width">
                      <label>Diagnosis</label>
                      <span>{selectedItem.diagnosis}</span>
                    </div>
                    {selectedItem.treatment_notes && (
                      <div className="detail-item full-width">
                        <label>Treatment Notes</label>
                        <span>{selectedItem.treatment_notes}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <label>Plan Code</label>
                      <span>{selectedItem.planCode}</span>
                    </div>
                    {selectedItem.deleteReason && (
                      <div className="detail-item">
                        <label>Completion Reason</label>
                        <span>{selectedItem.deleteReason}</span>
                      </div>
                    )}
                  </>
                )}
                
                {selectedItem.type === 'prescription' && (
                  <>
                    <div className="detail-item">
                      <label>Prescription Code</label>
                      <span>{selectedItem.prescriptionCode}</span>
                    </div>
                    <div className="detail-item">
                      <label>Medicine Count</label>
                      <span>{selectedItem.medicineCount} medicines</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Medicines</label>
                      <div className="medicines-detailed">
                        {selectedItem.medicines?.map((medicine, idx) => (
                          <div key={idx} className="medicine-detailed">
                            <strong>{medicine.name}</strong>
                            <span>{medicine.dosage}</span>
                            {medicine.instructions && <p>{medicine.instructions}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {selectedItem.type === 'appointment' && (
                  <>
                    <div className="detail-item">
                      <label>Status</label>
                      <span className={`status-badge ${selectedItem.status}`}>
                        {selectedItem.status}
                      </span>
                    </div>
                    {selectedItem.reason && (
                      <div className="detail-item">
                        <label>Reason</label>
                        <span>{selectedItem.reason}</span>
                      </div>
                    )}
                    {selectedItem.notes && (
                      <div className="detail-item full-width">
                        <label>Notes</label>
                        <span>{selectedItem.notes}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-primary" onClick={closeDetailModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

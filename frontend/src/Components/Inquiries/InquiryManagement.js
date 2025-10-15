import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { 
  ArrowLeft, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  MessageSquare, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader
} from "lucide-react";
import "./inquiry-management.css";

function InquiryBreadcrumb({ navigate }) {
  return (
    <div className="inquiry-breadcrumb">
      <button 
        className="breadcrumb-back-btn"
        onClick={() => navigate("/profile")}
      >
        <ArrowLeft size={16} />
        Back to Profile
      </button>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-current">My Inquiries</span>
    </div>
  );
}

function InquiryCard({ inquiry, onView, onEdit, onDelete, canEdit, canDelete }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle className="text-orange-500" size={16} />;
      case 'in_progress': return <Clock className="text-blue-500" size={16} />;
      case 'resolved': return <CheckCircle className="text-green-500" size={16} />;
      default: return <AlertCircle className="text-gray-500" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'orange';
      case 'in_progress': return 'blue';
      case 'resolved': return 'green';
      default: return 'gray';
    }
  };

  return (
    <div className="inquiry-card">
      <div className="inquiry-header">
        <div className="inquiry-icon">
          <MessageSquare className="text-teal-600" size={20} />
        </div>
        <div className="inquiry-info">
          <h4 className="inquiry-title">{inquiry.subject}</h4>
          <p className="inquiry-date">
            <Calendar size={14} />
            {new Date(inquiry.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="inquiry-status">
          <span className={`status-badge ${getStatusColor(inquiry.status)}`}>
            {getStatusIcon(inquiry.status)}
            {inquiry.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      <div className="inquiry-content">
        <p className="inquiry-message">{inquiry.message}</p>
        {inquiry.responses && inquiry.responses.length > 0 && (
          <div className="inquiry-responses">
            <span className="response-count">
              {inquiry.responses.length} response{inquiry.responses.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      
      <div className="inquiry-actions">
        <button 
          className="action-btn view"
          onClick={() => onView(inquiry)}
        >
          <Eye size={16} />
          View
        </button>
        {canEdit && (
          <button 
            className="action-btn edit"
            onClick={() => onEdit(inquiry)}
          >
            <Edit3 size={16} />
            Edit
          </button>
        )}
        {canDelete && (
          <button 
            className="action-btn delete"
            onClick={() => onDelete(inquiry)}
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function InquiryForm({ inquiry, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    subject: inquiry?.subject || '',
    message: inquiry?.message || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="inquiry-form-overlay">
      <div className="inquiry-form">
        <div className="form-header">
          <h3>{inquiry ? 'Edit Inquiry' : 'New Inquiry'}</h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="subject">Subject *</label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="Enter inquiry subject"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="message">Message *</label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Describe your inquiry in detail"
              rows={5}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  {inquiry ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {inquiry ? 'Update Inquiry' : 'Create Inquiry'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InquiryDetail({ inquiry, onClose, onEdit, onDelete, canEdit, canDelete }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle className="text-orange-500" size={20} />;
      case 'in_progress': return <Clock className="text-blue-500" size={20} />;
      case 'resolved': return <CheckCircle className="text-green-500" size={20} />;
      default: return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'orange';
      case 'in_progress': return 'blue';
      case 'resolved': return 'green';
      default: return 'gray';
    }
  };

  return (
    <div className="inquiry-detail-overlay">
      <div className="inquiry-detail">
        <div className="detail-header">
          <div className="detail-title">
            <h3>{inquiry.subject}</h3>
            <span className={`status-badge ${getStatusColor(inquiry.status)}`}>
              {getStatusIcon(inquiry.status)}
              {inquiry.status.replace('_', ' ')}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="detail-content">
          <div className="detail-meta">
            <p><strong>Created:</strong> {new Date(inquiry.createdAt).toLocaleString()}</p>
            <p><strong>Updated:</strong> {new Date(inquiry.updatedAt).toLocaleString()}</p>
            <p><strong>Inquiry Code:</strong> {inquiry.inquiryCode}</p>
          </div>
          
          <div className="detail-message">
            <h4>Message:</h4>
            <p>{inquiry.message}</p>
          </div>
          
          {inquiry.responses && inquiry.responses.length > 0 && (
            <div className="detail-responses">
              <h4>Staff Responses:</h4>
              {inquiry.responses.map((response, index) => (
                <div key={index} className="response-item">
                  <div className="response-header">
                    <span className="response-author">Staff Member</span>
                    <span className="response-date">
                      {new Date(response.at).toLocaleString()}
                    </span>
                  </div>
                  <p className="response-text">{response.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="detail-actions">
          {canEdit && (
            <button 
              className="action-btn edit"
              onClick={() => onEdit(inquiry)}
            >
              <Edit3 size={16} />
              Edit
            </button>
          )}
          {canDelete && (
            <button 
              className="action-btn delete"
              onClick={() => onDelete(inquiry)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InquiryManagement() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    fetchInquiries();
  }, [navigate, isAuthenticated]);

  const fetchInquiries = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://localhost:5000/api/inquiries/my", {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch inquiries");
      }

      const data = await response.json();
      setInquiries(data.inquiries || []);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      setError("Unable to load inquiries. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInquiry = async (formData) => {
    setFormLoading(true);
    setError(""); // Clear any previous errors
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Creating inquiry with data:", formData);

      const response = await fetch("http://localhost:5000/api/inquiries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      console.log("Create response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Create failed:", errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to create inquiry`);
      }

      const data = await response.json();
      console.log("Create successful:", data);

      if (data.success && data.inquiry) {
        setInquiries([data.inquiry, ...inquiries]);
        setShowForm(false);
        setError("");
      } else {
        throw new Error(data.message || "Create failed - invalid response");
      }
    } catch (error) {
      console.error('Error creating inquiry:', error);
      setError(error.message || "Failed to create inquiry. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateInquiry = async (formData) => {
    setFormLoading(true);
    setError(""); // Clear any previous errors
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Updating inquiry:", editingInquiry._id, "with data:", formData);

      const response = await fetch(`http://localhost:5000/api/inquiries/${editingInquiry._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      console.log("Update response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Update failed:", errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to update inquiry`);
      }

      const data = await response.json();
      console.log("Update successful:", data);

      if (data.success && data.inquiry) {
        setInquiries(inquiries.map(inq => 
          inq._id === editingInquiry._id ? data.inquiry : inq
        ));
        setShowForm(false);
        setEditingInquiry(null);
        setError("");
      } else {
        throw new Error(data.message || "Update failed - invalid response");
      }
    } catch (error) {
      console.error('Error updating inquiry:', error);
      setError(error.message || "Failed to update inquiry. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteInquiry = async (inquiry) => {
    if (!window.confirm("Are you sure you want to delete this inquiry?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/inquiries/${inquiry._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete inquiry");
      }

      setInquiries(inquiries.filter(inq => inq._id !== inquiry._id));
      setShowDetail(false);
      setSelectedInquiry(null);
      setError("");
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      setError("Failed to delete inquiry. Please try again.");
    }
  };

  const handleViewInquiry = (inquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetail(true);
  };

  const handleEditInquiry = (inquiry) => {
    setEditingInquiry(inquiry);
    setShowForm(true);
    setShowDetail(false);
  };

  const handleDeleteFromDetail = (inquiry) => {
    setShowDetail(false);
    setSelectedInquiry(null);
    handleDeleteInquiry(inquiry);
  };

  const canEdit = (inquiry) => inquiry.status !== 'resolved';
  const canDelete = (inquiry) => !inquiry.responses || inquiry.responses.length === 0;

  if (loading) {
    return (
      <div className="inquiry-page">
        <div className="inquiry-container">
          <InquiryBreadcrumb navigate={navigate} />
          <div className="inquiry-loading">
            <Loader size={32} className="animate-spin" />
            <p>Loading your inquiries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-page">
      <div className="inquiry-container">
        <InquiryBreadcrumb navigate={navigate} />
        
        <div className="inquiry-header">
          <div className="inquiry-title-section">
            <h1>My Inquiries</h1>
            <p>Manage your support inquiries and track their status</p>
          </div>
          <button 
            className="btn-primary"
            onClick={() => setShowForm(true)}
          >
            <Plus size={20} />
            New Inquiry
          </button>
        </div>

        {error && (
          <div className="inquiry-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {inquiries.length === 0 ? (
          <div className="inquiry-empty">
            <MessageSquare size={48} className="text-gray-400" />
            <h3>No Inquiries Yet</h3>
            <p>You haven't submitted any inquiries yet. Click "New Inquiry" to get started.</p>
            <button 
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={20} />
              Create Your First Inquiry
            </button>
          </div>
        ) : (
          <div className="inquiries-grid">
            {inquiries.map((inquiry) => (
              <InquiryCard
                key={inquiry._id}
                inquiry={inquiry}
                onView={handleViewInquiry}
                onEdit={handleEditInquiry}
                onDelete={handleDeleteInquiry}
                canEdit={canEdit(inquiry)}
                canDelete={canDelete(inquiry)}
              />
            ))}
          </div>
        )}

        {showForm && (
          <InquiryForm
            inquiry={editingInquiry}
            onSubmit={editingInquiry ? handleUpdateInquiry : handleCreateInquiry}
            onCancel={() => {
              setShowForm(false);
              setEditingInquiry(null);
            }}
            loading={formLoading}
          />
        )}

        {showDetail && selectedInquiry && (
          <InquiryDetail
            inquiry={selectedInquiry}
            onClose={() => {
              setShowDetail(false);
              setSelectedInquiry(null);
            }}
            onEdit={handleEditInquiry}
            onDelete={handleDeleteFromDetail}
            canEdit={canEdit(selectedInquiry)}
            canDelete={canDelete(selectedInquiry)}
          />
        )}
      </div>
    </div>
  );
}

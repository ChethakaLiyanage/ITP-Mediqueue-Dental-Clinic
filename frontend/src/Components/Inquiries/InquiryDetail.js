import React, { useState, useEffect } from 'react';
import { useAuth } from "../../Contexts/AuthContext";
import { useParams, Link } from 'react-router-dom';
import './inquiry-detail.css';

const InquiryDetail = () => {
  const { token } = useAuth();
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/inquiries/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setInquiry(data.inquiry);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to fetch inquiry details');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (token && id) {
      fetchInquiry();
    }
  }, [token, id]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'status-open';
      case 'in_progress': return 'status-progress';
      case 'resolved': return 'status-resolved';
      default: return 'status-open';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return 'fas fa-clock';
      case 'in_progress': return 'fas fa-spinner';
      case 'resolved': return 'fas fa-check-circle';
      default: return 'fas fa-clock';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatResponseDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="inquiry-detail-container">
        <div className="loading">Loading inquiry details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inquiry-detail-container">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
        <Link to="/profile/inquiries" className="btn btn-primary">
          Back to Inquiries
        </Link>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="inquiry-detail-container">
        <div className="error-message">
          <i className="fas fa-question-circle"></i>
          Inquiry not found
        </div>
        <Link to="/profile/inquiries" className="btn btn-primary">
          Back to Inquiries
        </Link>
      </div>
    );
  }

  return (
    <div className="inquiry-detail-container">
      <div className="inquiry-detail-header">
        <Link to="/profile/inquiries" className="back-link">
          <i className="fas fa-arrow-left"></i> Back to Inquiries
        </Link>
        
        <div className="inquiry-title-section">
          <div className="inquiry-code-badge">#{inquiry.inquiryCode}</div>
          <h1>{inquiry.subject}</h1>
          <div className={`inquiry-status-large ${getStatusColor(inquiry.status)}`}>
            <i className={getStatusIcon(inquiry.status)}></i>
            {inquiry.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      <div className="inquiry-detail-content">
        {/* Original Inquiry */}
        <div className="inquiry-original">
          <div className="inquiry-meta">
            <div className="meta-item">
              <i className="fas fa-calendar"></i>
              <span>Created: {formatDate(inquiry.createdAt)}</span>
            </div>
            {inquiry.updatedAt !== inquiry.createdAt && (
              <div className="meta-item">
                <i className="fas fa-edit"></i>
                <span>Updated: {formatDate(inquiry.updatedAt)}</span>
              </div>
            )}
            {inquiry.assignedTo && (
              <div className="meta-item">
                <i className="fas fa-user"></i>
                <span>Assigned to: {inquiry.assignedTo}</span>
              </div>
            )}
          </div>

          <div className="inquiry-message">
            <h3>Your Inquiry</h3>
            <div className="message-content">
              {inquiry.message.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Responses */}
        {inquiry.responses && inquiry.responses.length > 0 && (
          <div className="inquiry-responses">
            <h3>
              <i className="fas fa-reply"></i>
              Responses ({inquiry.responses.length})
            </h3>
            
            <div className="responses-list">
              {inquiry.responses.map((response, index) => (
                <div key={index} className="response-item">
                  <div className="response-header">
                    <div className="response-author">
                      <i className="fas fa-user-tie"></i>
                      {response.receptionistCode || 'Support Team'}
                    </div>
                    <div className="response-date">
                      {formatResponseDate(response.at)}
                    </div>
                  </div>
                  <div className="response-content">
                    {response.text.split('\n').map((line, lineIndex) => (
                      <p key={lineIndex}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Information */}
        <div className="inquiry-status-info">
          {inquiry.status === 'open' && (
            <div className="status-message open">
              <i className="fas fa-clock"></i>
              <div>
                <strong>Your inquiry is open</strong>
                <p>We've received your inquiry and will respond as soon as possible.</p>
              </div>
            </div>
          )}
          
          {inquiry.status === 'in_progress' && (
            <div className="status-message progress">
              <i className="fas fa-spinner"></i>
              <div>
                <strong>Your inquiry is being processed</strong>
                <p>Our team is working on your inquiry and will provide an update soon.</p>
              </div>
            </div>
          )}
          
          {inquiry.status === 'resolved' && (
            <div className="status-message resolved">
              <i className="fas fa-check-circle"></i>
              <div>
                <strong>Your inquiry has been resolved</strong>
                <p>We hope we've addressed your concern. If you need further assistance, please submit a new inquiry.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="inquiry-actions">
          {inquiry.status !== 'resolved' && (
            <div className="action-note">
              <i className="fas fa-info-circle"></i>
              <p>If you need to add more information to this inquiry, please submit a new inquiry referencing <strong>#{inquiry.inquiryCode}</strong>.</p>
            </div>
          )}
          
          <div className="action-buttons">
            <Link to="/profile/inquiries/new" className="btn btn-outline">
              <i className="fas fa-plus"></i>
              Submit New Inquiry
            </Link>
            <Link to="/profile/inquiries" className="btn btn-primary">
              <i className="fas fa-list"></i>
              View All Inquiries
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InquiryDetail;

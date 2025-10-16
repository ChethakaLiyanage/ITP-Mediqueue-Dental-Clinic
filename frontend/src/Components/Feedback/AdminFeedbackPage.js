import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './adminfeedback.css';

const AdminFeedbackPage = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  
  // Filters
  const [filters, setFilters] = useState({
    rating: 'all',
    dateRange: 'all',
    search: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Selected feedback for response
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  // Get auth token
  const getAuthToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      return auth.token;
    } catch {
      return null;
    }
  };

  // Fetch all feedback
  const fetchFeedbacks = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching feedbacks from API...');
      const response = await axios.get('http://localhost:5000/feedbacks', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Feedback API response:', response.data);
      
      if (response.data && response.data.feedbacks) {
        setFeedbacks(response.data.feedbacks);
        calculateStats(response.data.feedbacks);
        console.log(`Loaded ${response.data.feedbacks.length} feedbacks`);
      } else {
        console.warn('No feedbacks found in response');
        setFeedbacks([]);
        calculateStats([]);
      }
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
        setError(`Failed to load feedback data: ${err.response.data?.message || err.response.statusText}`);
      } else if (err.request) {
        setError('Failed to connect to server. Please check if the backend is running.');
      } else {
        setError('Failed to load feedback data: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (feedbackData) => {
    const total = feedbackData.length;
    const average = total > 0 ? feedbackData.reduce((sum, fb) => sum + fb.rating, 0) / total : 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    feedbackData.forEach(fb => {
      distribution[fb.rating]++;
    });

    setStats({ total, average: Math.round(average * 10) / 10, distribution });
  };

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(feedback => {
    // Rating filter
    if (filters.rating !== 'all' && feedback.rating !== parseInt(filters.rating)) {
      return false;
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const feedbackDate = new Date(feedback.submitted_date);
      const now = new Date();
      const daysDiff = Math.floor((now - feedbackDate) / (1000 * 60 * 60 * 24));

      switch (filters.dateRange) {
        case 'today':
          return daysDiff === 0;
        case 'week':
          return daysDiff <= 7;
        case 'month':
          return daysDiff <= 30;
        case 'year':
          return daysDiff <= 365;
        default:
          return true;
      }
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const userName = feedback.user?.name?.toLowerCase() || '';
      const comment = feedback.comment?.toLowerCase() || '';
      return userName.includes(searchTerm) || comment.includes(searchTerm);
    }

    return true;
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFeedbacks = filteredFeedbacks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredFeedbacks.length / itemsPerPage);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle feedback response
  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFeedback || !responseText.trim()) return;

    setResponding(true);
    try {
      // Here you would typically send the response to the backend
      // For now, we'll just show a success message
      alert('Response sent successfully!');
      setSelectedFeedback(null);
      setResponseText('');
    } catch (err) {
      console.error('Error sending response:', err);
      alert('Failed to send response');
    } finally {
      setResponding(false);
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) return;

    try {
      const token = getAuthToken();
      console.log('Deleting feedback:', feedbackId);
      
      await axios.delete(`http://localhost:5000/feedbacks/admin/${feedbackId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('Feedback deleted successfully');
      
      // Remove from local state
      const updatedFeedbacks = feedbacks.filter(fb => fb._id !== feedbackId);
      setFeedbacks(updatedFeedbacks);
      calculateStats(updatedFeedbacks);
      
      alert('Feedback deleted successfully!');
    } catch (err) {
      console.error('Error deleting feedback:', err);
      if (err.response) {
        console.error('Delete response status:', err.response.status);
        console.error('Delete response data:', err.response.data);
        alert(`Failed to delete feedback: ${err.response.data?.message || err.response.statusText}`);
      } else {
        alert('Failed to delete feedback: ' + err.message);
      }
    }
  };

  // Export feedback to CSV
  const exportToCSV = () => {
    const csvHeaders = ['Patient Name', 'Patient Email', 'Rating', 'Comment', 'Date Submitted'];
    const csvData = filteredFeedbacks.map(feedback => [
      feedback.user?.name || 'Unknown',
      feedback.user?.email || 'No email',
      feedback.rating,
      `"${(feedback.comment || '').replace(/"/g, '""')}"`, // Escape quotes in comments
      new Date(feedback.submitted_date).toLocaleDateString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export feedback to JSON
  const exportToJSON = () => {
    const jsonData = filteredFeedbacks.map(feedback => ({
      patientName: feedback.user?.name || 'Unknown',
      patientEmail: feedback.user?.email || 'No email',
      rating: feedback.rating,
      comment: feedback.comment || '',
      dateSubmitted: feedback.submitted_date,
      id: feedback._id
    }));

    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `feedback_export_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  // Star rating component
  const StarRating = ({ rating }) => {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`star ${star <= rating ? 'filled' : ''}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  // Get rating color
  const getRatingColor = (rating) => {
    if (rating >= 4) return '#10b981'; // Green
    if (rating >= 3) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <div className="admin-feedback-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading feedback data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-feedback-page">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Feedback</h3>
          <p>{error}</p>
          <button 
            className="retry-btn"
            onClick={fetchFeedbacks}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-feedback-page">
      <div className="page-header">
        <h1>Patient Feedback Management</h1>
        <p>Monitor and manage all patient feedback and reviews</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{stats.total}</h3>
            <p>Total Reviews</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <h3>{stats.average}</h3>
            <p>Average Rating</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">😊</div>
          <div className="stat-content">
            <h3>{stats.distribution[5] + stats.distribution[4]}</h3>
            <p>Positive Reviews</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">😐</div>
          <div className="stat-content">
            <h3>{stats.distribution[3]}</h3>
            <p>Neutral Reviews</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">😞</div>
          <div className="stat-content">
            <h3>{stats.distribution[2] + stats.distribution[1]}</h3>
            <p>Negative Reviews</p>
          </div>
        </div>
      </div>

      {/* Rating Distribution Chart */}
      <div className="rating-distribution">
        <h3>Rating Distribution</h3>
        <div className="distribution-bars">
          {[5, 4, 3, 2, 1].map(rating => {
            const count = stats.distribution[rating];
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={rating} className="distribution-bar">
                <div className="bar-label">
                  <span className="rating-number">{rating}</span>
                  <span className="rating-stars">★★★★★</span>
                  <span className="count">({count})</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar-fill"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: getRatingColor(rating)
                    }}
                  ></div>
                </div>
                <span className="percentage">{percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-group">
          <input
            type="text"
            placeholder="Search by patient name or comment..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Rating:</label>
            <select
              value={filters.rating}
              onChange={(e) => handleFilterChange('rating', e.target.value)}
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Date Range:</label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>

          <div className="action-buttons-group">
            <button 
              onClick={exportToCSV} 
              className="export-btn csv-btn"
              title="Export to CSV"
            >
              📊 CSV
            </button>
            <button 
              onClick={exportToJSON} 
              className="export-btn json-btn"
              title="Export to JSON"
            >
              📄 JSON
            </button>
            <button 
              onClick={fetchFeedbacks} 
              className="refresh-btn"
              title="Refresh Data"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Table */}
      <div className="feedback-table-container">
        <table className="feedback-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentFeedbacks.length > 0 ? (
              currentFeedbacks.map((feedback) => (
                <tr key={feedback._id}>
                  <td>
                    <div className="patient-info">
                      <div className="patient-avatar">
                        {feedback.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="patient-details">
                        <div className="patient-name">
                          {feedback.user?.name || 'Unknown Patient'}
                        </div>
                        <div className="patient-email">
                          {feedback.user?.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="rating-cell">
                      <StarRating rating={feedback.rating} />
                      <span 
                        className="rating-number"
                        style={{ color: getRatingColor(feedback.rating) }}
                      >
                        {feedback.rating}/5
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="comment-cell">
                      {feedback.comment ? (
                        <div className="comment-text">{feedback.comment}</div>
                      ) : (
                        <span className="no-comment">No comment</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="date-cell">
                      {new Date(feedback.submitted_date).toLocaleDateString()}
                      <div className="time">
                        {new Date(feedback.submitted_date).toLocaleTimeString()}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => setSelectedFeedback(feedback)}
                        className="action-btn respond-btn"
                        title="Respond to Feedback"
                      >
                        💬
                      </button>
                      <button
                        onClick={() => handleDeleteFeedback(feedback._id)}
                        className="action-btn delete-btn"
                        title="Delete Feedback"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data">
                  {filteredFeedbacks.length === 0 && feedbacks.length > 0 
                    ? 'No feedback matches your filters'
                    : 'No feedback available'
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="page-btn"
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            Next
          </button>
        </div>
      )}

      {/* Response Modal */}
      {selectedFeedback && (
        <div className="modal-overlay">
          <div className="modal-content response-modal">
            <div className="modal-header">
              <h3>Respond to Feedback</h3>
              <button 
                className="close-btn" 
                onClick={() => setSelectedFeedback(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="feedback-preview">
                <div className="patient-info">
                  <strong>{selectedFeedback.user?.name || 'Unknown Patient'}</strong>
                  <StarRating rating={selectedFeedback.rating} />
                </div>
                <div className="feedback-comment">
                  "{selectedFeedback.comment || 'No comment provided'}"
                </div>
                <div className="feedback-date">
                  {new Date(selectedFeedback.submitted_date).toLocaleDateString()}
                </div>
              </div>
              
              <form onSubmit={handleResponseSubmit}>
                <div className="form-group">
                  <label>Your Response:</label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your response to this feedback..."
                    rows="4"
                    required
                  />
                </div>
                
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setSelectedFeedback(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={responding || !responseText.trim()}
                    className="btn btn-primary"
                  >
                    {responding ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedbackPage;

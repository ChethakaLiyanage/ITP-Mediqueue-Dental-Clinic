import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import {
  Star,
  Edit3,
  Trash2,
  MessageSquare,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Loader,
  ArrowLeft,
  Plus
} from "lucide-react";
import "./myReviews.css";

export default function MyReviews() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingReview, setEditingReview] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 0, comment: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ rating: 0, comment: "" });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    fetchReviews();
  }, [isAuthenticated, navigate]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      console.log("Fetching reviews with token:", token.substring(0, 20) + "...");
      
      const response = await fetch("http://localhost:5000/feedbacks/my-reviews", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch reviews`);
      }

      const data = await response.json();
      console.log("Received reviews:", data);
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setError(err.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (review) => {
    setEditingReview(review);
    setEditForm({
      rating: review.rating,
      comment: review.comment
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingReview) return;

    try {
      setSubmitting(true);
      setError("");
      const token = localStorage.getItem("token");
      
      console.log("Updating review:", editingReview._id, "with data:", editForm);
      
      const response = await fetch(`http://localhost:5000/feedbacks/${editingReview._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update review");
      }

      const data = await response.json();
      console.log("Review updated successfully:", data);

      // Update the review in the local state
      setReviews(prev => 
        prev.map(review => 
          review._id === editingReview._id 
            ? { ...review, ...editForm, updatedAt: new Date().toISOString() }
            : review
        )
      );

      setEditingReview(null);
      setEditForm({ rating: 0, comment: "" });
    } catch (err) {
      console.error("Error updating review:", err);
      setError(err.message || "Failed to update review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      setError("");
      const token = localStorage.getItem("token");
      
      console.log("Deleting review:", reviewId);
      
      const response = await fetch(`http://localhost:5000/feedbacks/${reviewId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete review");
      }

      console.log("Review deleted successfully");
      
      // Remove the review from local state
      setReviews(prev => prev.filter(review => review._id !== reviewId));
    } catch (err) {
      console.error("Error deleting review:", err);
      setError(err.message || "Failed to delete review");
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    
    if (addForm.rating === 0) {
      setError("Please select a rating");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const token = localStorage.getItem("token");
      
      console.log("Creating review with data:", addForm);
      
      const response = await fetch("http://localhost:5000/feedbacks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(addForm)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create review");
      }

      const data = await response.json();
      console.log("Review created successfully:", data);

      // Add the new review to local state
      setReviews(prev => [data.feedback, ...prev]);
      setShowAddForm(false);
      setAddForm({ rating: 0, comment: "" });
    } catch (err) {
      console.error("Error creating review:", err);
      setError(err.message || "Failed to create review");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const getRatingText = (rating) => {
    const ratingTexts = {
      1: "Poor",
      2: "Fair", 
      3: "Good",
      4: "Very Good",
      5: "Excellent"
    };
    return ratingTexts[rating] || "";
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => {
      const isFilled = index < rating;
      const starColor = isFilled ? "star-filled" : "star-empty";
      
      return (
        <Star
          key={index}
          size={18}
          className={`star-icon ${starColor}`}
        />
      );
    });
  };

  if (loading) {
    return (
      <div className="my-reviews-container">
        <div className="loading-state">
          <Loader className="animate-spin" size={32} />
          <p>Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-reviews-container">
      <div className="my-reviews-header">
        <button
          onClick={() => navigate("/profile")}
          className="back-button"
        >
          <ArrowLeft size={20} />
          Back to Profile
        </button>
        
        <div className="header-content">
          <h1>My Reviews</h1>
          <p>Manage your feedback and reviews</p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="add-review-button"
        >
          <Plus size={20} />
          Add New Review
        </button>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={48} className="empty-icon" />
          <h3>No Reviews Yet</h3>
          <p>You haven't submitted any reviews yet. Share your experience with us!</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="primary-button"
          >
            <Plus size={20} />
            Write Your First Review
          </button>
        </div>
      ) : (
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review._id} className="review-card">
              <div className="review-header">
                <div className="review-rating">
                  {renderStars(review.rating)}
                  <div className="rating-info" data-rating={review.rating}>
                    <span className="rating-text">{review.rating}/5</span>
                    <span className="rating-level">{getRatingText(review.rating)}</span>
                  </div>
                </div>
                <div className="review-date">
                  <Calendar size={16} />
                  {formatDate(review.createdAt)}
                  {review.updatedAt !== review.createdAt && (
                    <span className="updated-badge">Updated</span>
                  )}
                </div>
              </div>

              {review.comment && (
                <div className="review-comment">
                  <MessageSquare size={16} />
                  <p>{review.comment}</p>
                </div>
              )}

              <div className="review-actions">
                <button
                  onClick={() => handleEdit(review)}
                  className="action-button edit"
                >
                  <Edit3 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(review._id)}
                  className="action-button delete"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingReview && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <div className="modal-header">
              <h3>Edit Review</h3>
              <button
                onClick={() => setEditingReview(null)}
                className="close-button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="edit-form">
              <div className="form-group">
                <label>Rating</label>
                <div className="star-rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-button ${star <= editForm.rating ? "active" : ""}`}
                      onClick={() => setEditForm(prev => ({ ...prev, rating: star }))}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Comment</label>
                <textarea
                  value={editForm.comment}
                  onChange={(e) => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Share your experience..."
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="cancel-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || editForm.rating === 0}
                  className="save-button"
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <div className="modal-header">
              <h3>Add New Review</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm({ rating: 0, comment: "" });
                }}
                className="close-button"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="edit-form">
              <div className="form-group">
                <label>Rating *</label>
                <div className="star-rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-button ${addForm.rating >= star ? 'active' : ''}`}
                      onClick={() => setAddForm({ ...addForm, rating: star })}
                    >
                      <Star size={24} />
                    </button>
                  ))}
                </div>
                {addForm.rating > 0 && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    {getRatingText(addForm.rating)}
                  </p>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="add-comment">Comment</label>
                <textarea
                  id="add-comment"
                  value={addForm.comment}
                  onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
                  placeholder="Share your experience with us..."
                  rows={4}
                />
              </div>
              
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddForm({ rating: 0, comment: "" });
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || addForm.rating === 0}
                  className="save-button"
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin" size={16} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Review
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

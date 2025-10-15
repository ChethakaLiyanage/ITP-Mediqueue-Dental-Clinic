// src/Components/Feedback.js
import React, { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../../Contexts/AuthContext";
import "./feedback.css";

const API_BASE = "http://localhost:5000";

function EnhancedStarRating({ rating, onRatingChange, hoverRating, setHoverRating }) {
  return (
    <div className="enhanced-star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-button ${star <= (hoverRating || rating) ? "active" : ""}`}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            outline: "none",
            cursor: "pointer"
          }}
          onClick={() => onRatingChange(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          aria-label={`Rate ${star} stars`}
        >
          <i
            className="fas fa-star"
            style={{
              color: star <= (hoverRating || rating) ? "#FFD700" : "#C9CED6",
              transition: "color 150ms ease"
            }}
          ></i>
          <div className="star-glow"></div>
        </button>
      ))}
    </div>
  );
}

export default function PremiumFeedbackForm() {
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRating, setSubmittedRating] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (rating === 0) {
        setError("Please select a star rating to continue");
        return;
      }

      setIsSubmitting(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        
        if (!token) {
          setError("Please log in to submit feedback");
          return;
        }

        console.log("Submitting feedback with token:", token.substring(0, 20) + "...");
        
        await axios.post(`${API_BASE}/feedbacks`, {
          rating,
          comment: comment.trim() || "",
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        setSubmittedRating(rating);
        setSubmitted(true);
        setRating(0);
        setHoverRating(0);
        setComment("");

        setTimeout(() => setSubmitted(false), 4000);
      } catch (err) {
        console.error("Feedback submission error:", err);
        
        if (err.response) {
          // Server responded with error status
          const errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
          setError(errorMessage);
        } else if (err.request) {
          // Network error
          setError("Network error. Please check your connection and try again.");
        } else {
          // Other error
          setError("Unable to submit feedback. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [rating, comment]
  );

  const getRatingText = (currentRating) => {
    const displayRating = hoverRating || currentRating;
    const texts = {
      1: "Poor Experience",
      2: "Below Average",
      3: "Average Service",
      4: "Great Experience",
      5: "Outstanding Service!",
    };
    return texts[displayRating] || "Rate Your Experience";
  };

  if (!isAuthenticated) {
    return (
      <div className="feedback-login-prompt">
        <div className="login-prompt-content">
          <i className="fas fa-lock"></i>
          <h3>Please Log In to Submit Feedback</h3>
          <p>You need to be logged in to submit feedback and reviews.</p>
          <a href="/login" className="login-button">
            <i className="fas fa-sign-in-alt"></i>
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="feedback-success-container">
        <h3>Thank You for Your Feedback!</h3>
        <p>Your {submittedRating || 0}-star review helps us provide better dental care for everyone.</p>
      </div>
    );
  }

  return (
    <div className="enhanced-feedback-container">
      <div className="feedback-header">
        <div className="header-icon">
          <i className="fas fa-heart"></i>
        </div>
        <h3>Share Your Experience</h3>
        <p>Your feedback helps us improve our dental care services</p>
      </div>

      <form onSubmit={handleSubmit} className="enhanced-feedback-form">
        <div className="rating-section">
          <div className="rating-area">
            <EnhancedStarRating
              rating={rating}
              onRatingChange={setRating}
              hoverRating={hoverRating}
              setHoverRating={setHoverRating}
            />
            <div className="rating-text">{getRatingText(rating)}</div>
          </div>
        </div>

        <div className="comment-section">
          <label htmlFor="feedback-comment" className="comment-label">
            Comments (optional)
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add any comments about your visit (optional)."
            maxLength={300}
            rows={4}
            className="comment-textarea"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="submit-button" disabled={isSubmitting || rating === 0}>
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}

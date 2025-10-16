const Feedback = require("../Model/FeedbackModel");

// GET /feedback - list all feedback (admin or analytics use)
async function getAllFeedbacks(req, res) {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).populate("user", "name email").lean();
    return res.status(200).json({ feedbacks });
  } catch (err) {
    console.error("getAllFeedbacks error:", err);
    return res.status(500).json({ message: "Failed to fetch feedback", error: err.message });
  }
}

// POST /feedback - create new feedback for authenticated user
async function addFeedbacks(req, res) {
  try {
    const { rating, comment } = req.body || {};
    const userId = req?.user?.id || req?.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const feedback = await Feedback.create({
      rating,
      comment,
      user: userId,
      submitted_date: new Date(),
    });

    return res.status(201).json({ message: "Feedback submitted", feedback });
  } catch (err) {
    console.error("addFeedbacks error:", err);
    return res.status(500).json({ message: "Failed to save feedback", error: err.message });
  }
}

// GET /feedback/:id - fetch single feedback document
async function getById(req, res) {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id).populate("user", "name email").lean();
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "Failed to fetch feedback", error: err.message });
  }
}

// GET /feedback/my - current user's feedback entries
async function getUserReviews(req, res) {
  try {
    const userId = req?.user?.id || req?.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const reviews = await Feedback.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "name email").lean();

    return res.status(200).json({ reviews });
  } catch (err) {
    console.error("getUserReviews error:", err);
    return res.status(500).json({ message: "Failed to fetch reviews", error: err.message });
  }
}

// PATCH /feedback/:id - update an existing feedback entity
async function updateFeedback(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body || {};
    const userId = req?.user?.id || req?.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const feedback = await Feedback.findOne({ _id: id, user: userId });
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found or not authorized" });
    }

    feedback.rating = rating;
    feedback.comment = comment;
    feedback.updatedAt = new Date();
    await feedback.save();

    return res.status(200).json({ message: "Feedback updated successfully", feedback });
  } catch (err) {
    console.error("updateFeedback error:", err);
    return res.status(500).json({ message: "Failed to update feedback", error: err.message });
  }
}

// DELETE /feedback/:id - remove a feedback entry for the current user
async function deleteFeedback(req, res) {
  try {
    const { id } = req.params;
    const userId = req?.user?.id || req?.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const feedback = await Feedback.findOneAndDelete({ _id: id, user: userId });
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found or not authorized" });
    }

    return res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    console.error("deleteFeedback error:", err);
    return res.status(500).json({ message: "Failed to delete feedback", error: err.message });
  }
}

// DELETE /feedback/admin/:id - remove any feedback entry (admin only)
async function deleteFeedbackAdmin(req, res) {
  try {
    const { id } = req.params;
    const userRole = req?.user?.role;

    // Check if user is admin or manager
    if (!userRole || !['Admin', 'Manager', 'admin', 'manager'].includes(userRole)) {
      return res.status(403).json({ message: "Admin or Manager access required" });
    }

    const feedback = await Feedback.findByIdAndDelete(id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    console.log(`Feedback ${id} deleted by ${req.user.name || req.user.email}`);
    return res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    console.error("deleteFeedbackAdmin error:", err);
    return res.status(500).json({ message: "Failed to delete feedback", error: err.message });
  }
}

module.exports = {
  getAllFeedbacks,
  addFeedbacks,
  getById,
  getUserReviews,
  updateFeedback,
  deleteFeedback,
  deleteFeedbackAdmin,
};

const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

const {
  addFeedbacks,
  getAllFeedbacks,
  getById,
  getUserReviews,
  updateFeedback,
  deleteFeedback,
  deleteFeedbackAdmin,
} = require("../Controllers/FeedbackControllers");

router.post("/", requireAuth, addFeedbacks);
router.get("/", getAllFeedbacks);
router.get("/my-reviews", requireAuth, getUserReviews);
router.get("/:id", getById);
router.put("/:id", requireAuth, updateFeedback);
router.delete("/:id", requireAuth, deleteFeedback);
router.delete("/admin/:id", requireAuth, deleteFeedbackAdmin);

module.exports = router;

const express = require("express");
const { submitFeedback, getEventFeedback } = require("../controllers/feedbackController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, submitFeedback);
router.get("/:eventId", getEventFeedback);

module.exports = router;

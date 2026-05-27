const express = require("express");
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getRecommended,
  getSeatStatus,
  getOrganizerEvents,
} = require("../controllers/eventController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

// Public / optional auth
router.get("/", optionalAuth, getEvents);
router.get("/recommendations", protect, getRecommended);
router.get("/organizer/my", protect, requireRole("organizer", "admin"), getOrganizerEvents);
router.get("/:id", optionalAuth, getEventById);
router.get("/:id/seats", getSeatStatus);

// Protected
router.post("/create", protect, requireRole("organizer", "admin"), createEvent);
router.put("/:id", protect, requireRole("organizer", "admin"), updateEvent);
router.delete("/:id", protect, requireRole("organizer", "admin"), deleteEvent);

module.exports = router;

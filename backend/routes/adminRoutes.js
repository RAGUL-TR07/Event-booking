const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const {
  getDashboardStats,
  getAllEvents,
  updateEventStatus,
  deleteEvent,
  getAllUsers,
  deleteUser,
  getAllBookings,
  adminCancelBooking,
  getWaitlists,
  getAllFeedback,
  getAnalytics,
  getLiveActivity,
} = require("../controllers/adminController");

// All admin routes require auth + admin role
router.use(protect, requireRole("admin"));

// Dashboard
router.get("/stats", getDashboardStats);

// Events
router.get("/events", getAllEvents);
router.patch("/events/:id/status", updateEventStatus);
router.delete("/events/:id", deleteEvent);

// Users
router.get("/users", getAllUsers);
router.delete("/users/:id", deleteUser);

// Bookings
router.get("/bookings", getAllBookings);
router.patch("/bookings/:id/cancel", adminCancelBooking);

// Waitlist
router.get("/waitlists", getWaitlists);

// Feedback
router.get("/feedback", getAllFeedback);

// Analytics
router.get("/analytics", getAnalytics);

// Live Activity
router.get("/activity", getLiveActivity);

module.exports = router;

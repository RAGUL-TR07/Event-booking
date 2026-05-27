const User = require("../models/User");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const Feedback = require("../models/Feedback");

// GET /api/user/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("bookmarkedEvents", "title date venue image category")
      .populate("recentViews", "title date venue image")
      .lean();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/user/profile
const updateProfile = async (req, res) => {
  try {
    const allowed = ["name", "email", "preferences"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/user/activity  — timeline of bookings, feedbacks
const getActivity = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id })
      .populate("eventId", "title date venue image category")
      .sort("-createdAt")
      .limit(20)
      .lean();

    const feedbacks = await Feedback.find({ userId: req.user._id })
      .populate("eventId", "title")
      .sort("-createdAt")
      .lean();

    const timeline = [
      ...tickets.map((t) => ({
        type: "booking",
        status: t.status,
        event: t.eventId,
        seatNumber: t.seatNumber,
        bookingNumber: t.bookingNumber,
        date: t.createdAt,
        ticketId: t._id,
      })),
      ...feedbacks.map((f) => ({
        type: "feedback",
        event: f.eventId,
        rating: f.rating,
        review: f.review,
        date: f.createdAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const stats = {
      totalBooked: tickets.filter((t) => t.status === "booked").length,
      totalAttended: req.user.attendedEvents?.length || 0,
      totalPoints: req.user.points,
      streak: req.user.streak,
      badges: req.user.badges,
    };

    res.json({ success: true, timeline, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/user/bookmark  — toggle bookmark
const toggleBookmark = async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ success: false, message: "eventId required." });

    const user = await User.findById(req.user._id);
    const idx = user.bookmarkedEvents.indexOf(eventId);
    let bookmarked;

    if (idx > -1) {
      user.bookmarkedEvents.splice(idx, 1);
      bookmarked = false;
    } else {
      user.bookmarkedEvents.push(eventId);
      bookmarked = true;
    }

    await user.save();
    res.json({ success: true, bookmarked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/user/leaderboard  — (also accessible as /api/leaderboard)
const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({})
      .select("refNo name points streak badges role")
      .sort("-points")
      .limit(20)
      .lean();

    const ranked = users.map((u, i) => ({ ...u, rank: i + 1 }));
    res.json({ success: true, leaderboard: ranked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProfile, updateProfile, getActivity, toggleBookmark, getLeaderboard };

const User = require("../models/User");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Feedback = require("../models/Feedback");

// ── Dashboard Stats ────────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [totalEvents, totalBookings, totalUsers, feedbacks, waitlistEvents] = await Promise.all([
      Event.countDocuments(),
      Ticket.countDocuments({ status: "booked" }),
      User.countDocuments({ role: "attendee" }),
      Feedback.find().lean(),
      Event.find({ "waitlist.0": { $exists: true } }).select("waitlist").lean(),
    ]);

    const avgRating = feedbacks.length
      ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
      : 0;

    const waitlistCount = waitlistEvents.reduce((s, e) => s + e.waitlist.length, 0);

    // Most popular event
    const popularEvent = await Event.findOne({ status: "approved" })
      .sort("-heatScore")
      .select("title heatScore totalSeats availableSeats")
      .lean();

    // Least performing
    const leastEvent = await Event.findOne({ status: "approved" })
      .sort("heatScore")
      .select("title heatScore totalSeats availableSeats")
      .lean();

    // Bookings last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentBookings = await Ticket.countDocuments({
      status: "booked",
      createdAt: { $gte: sevenDaysAgo },
    });

    res.json({
      success: true,
      stats: {
        totalEvents,
        totalBookings,
        totalUsers,
        avgRating: Number(avgRating),
        waitlistCount,
        recentBookings,
        popularEvent,
        leastEvent,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Event Management ───────────────────────────────────────────────────────
const getAllEvents = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { venue: { $regex: search, $options: "i" } },
    ];

    const total = await Event.countDocuments(filter);
    const events = await Event.find(filter)
      .populate("createdBy", "name refNo role")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Attach booking counts
    const enriched = await Promise.all(
      events.map(async (e) => {
        const bookings = await Ticket.countDocuments({ eventId: e._id, status: "booked" });
        const cancelled = await Ticket.countDocuments({ eventId: e._id, status: "cancelled" });
        return { ...e, _bookings: bookings, _cancelled: cancelled };
      })
    );

    res.json({ success: true, total, page: Number(page), events: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/events/:id/status  — approve / reject / cancel
const updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["approved", "rejected", "cancelled", "pending"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(", ")}` });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("createdBy", "name refNo");

    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/events/:id
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    // Cancel all associated tickets
    await Ticket.updateMany({ eventId: req.params.id }, { status: "cancelled" });

    res.json({ success: true, message: "Event deleted and all tickets cancelled." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User Management ────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { refNo: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-password")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const enriched = await Promise.all(
      users.map(async (u) => {
        const bookings = await Ticket.countDocuments({ userId: u._id, status: "booked" });
        return { ...u, _totalBookings: bookings };
      })
    );

    res.json({ success: true, total, users: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await Ticket.updateMany({ userId: req.params.id }, { status: "cancelled" });
    res.json({ success: true, message: `User ${user.refNo} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Booking Management ─────────────────────────────────────────────────────
const getAllBookings = async (req, res) => {
  try {
    const { status, eventId, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (eventId) filter.eventId = eventId;

    const total = await Ticket.countDocuments(filter);
    const bookings = await Ticket.find(filter)
      .populate("userId", "refNo name email")
      .populate("eventId", "title date venue")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, total, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/bookings/:id/cancel
const adminCancelBooking = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("eventId");
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });

    if (ticket.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Already cancelled." });
    }

    ticket.status = "cancelled";
    await ticket.save();

    // Free the seat
    if (ticket.seatNumber && ticket.eventId) {
      await Event.updateOne(
        { _id: ticket.eventId._id, "seatLayout.number": ticket.seatNumber },
        {
          $set: { "seatLayout.$.isBooked": false },
          $inc: { availableSeats: 1 },
        }
      );
    }

    res.json({ success: true, message: "Booking cancelled by admin." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Waitlist Management ────────────────────────────────────────────────────
const getWaitlists = async (req, res) => {
  try {
    const events = await Event.find({ "waitlist.0": { $exists: true } })
      .populate("waitlist.user", "refNo name email")
      .select("title date venue waitlist availableSeats totalSeats")
      .lean();

    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Feedback / Ratings ─────────────────────────────────────────────────────
const getAllFeedback = async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};

    const feedbacks = await Feedback.find(filter)
      .populate("userId", "refNo name")
      .populate("eventId", "title date")
      .sort("-createdAt")
      .lean();

    res.json({ success: true, feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Analytics ──────────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    // Bookings by category
    const categoryPipeline = [
      { $match: { status: "booked" } },
      { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
      { $unwind: "$event" },
      { $group: { _id: "$event.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];

    // Bookings over last 14 days
    const days = 14;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dailyPipeline = [
      { $match: { status: "booked", createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const [byCategory, byDay, topEvents] = await Promise.all([
      Ticket.aggregate(categoryPipeline),
      Ticket.aggregate(dailyPipeline),
      Event.find({ status: "approved" })
        .sort("-heatScore")
        .limit(5)
        .select("title heatScore totalSeats availableSeats category")
        .lean(),
    ]);

    res.json({ success: true, byCategory, byDay, topEvents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Live Activity ──────────────────────────────────────────────────────────
const getLiveActivity = async (req, res) => {
  try {
    const recent = await Ticket.find()
      .populate("userId", "refNo name")
      .populate("eventId", "title")
      .sort("-createdAt")
      .limit(20)
      .lean();

    const activity = recent.map((t) => ({
      type: t.status === "booked" ? "booking" : t.status,
      user: t.userId?.refNo || "Unknown",
      userName: t.userId?.name || "Unknown",
      event: t.eventId?.title || "Unknown Event",
      seat: t.seatNumber,
      bookingNumber: t.bookingNumber,
      time: t.createdAt,
    }));

    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};

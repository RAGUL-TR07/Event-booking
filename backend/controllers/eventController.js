const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { getRecommendations } = require("../services/recommendationService");

// GET /api/events  — list with filters, search, sort
const getEvents = async (req, res) => {
  try {
    const {
      category,
      status = "approved",
      search,
      sort = "-date",
      page = 1,
      limit = 12,
      upcoming,
    } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (upcoming === "true") filter.date = { $gte: new Date() };
    if (search) filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];

    const total = await Event.countDocuments(filter);
    const events = await Event.find(filter)
      .populate("createdBy", "name refNo")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      events,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name refNo")
      .lean();

    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    // Increment view count
    await Event.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    // Track recent view for logged-in user
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        // Add to recentViews, remove duplicate, keep last 20
        const views = user.recentViews.filter((v) => v.toString() !== event._id.toString());
        views.push(event._id);
        if (views.length > 20) views.shift();
        user.recentViews = views;
        await user.save();
      }
    }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/events/create
const createEvent = async (req, res) => {
  try {
    const { title, description, category, tags, date, endDate, venue, totalSeats, image } = req.body;
    if (!title || !description || !category || !date || !venue || !totalSeats) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const event = await Event.create({
      title, description, category, tags, date, endDate, venue, totalSeats, image,
      createdBy: req.user._id,
      status: req.user.role === "admin" ? "approved" : "pending",
    });

    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/events/:id
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    // Only creator or admin can update
    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    const allowed = ["title", "description", "category", "tags", "date", "endDate", "venue", "image"];
    allowed.forEach((k) => { if (req.body[k] !== undefined) event[k] = req.body[k]; });

    // Admin can change status
    if (req.user.role === "admin" && req.body.status) event.status = req.body.status;

    await event.save();
    res.json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/events/:id
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    if (event.createdBy.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Event deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/events/recommendations
const getRecommended = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const events = await getRecommendations(user, 10);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/events/:id/seats  — live seat status
const getSeatStatus = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("seatLayout availableSeats totalSeats waitlist");
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });

    res.json({
      success: true,
      totalSeats: event.totalSeats,
      availableSeats: event.availableSeats,
      waitlistCount: event.waitlist.length,
      seats: event.seatLayout.map((s) => ({
        number: s.number,
        isBooked: s.isBooked,
        isBlocked: s.isBlocked || false,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/events/organizer/my  — organizer's events with stats
const getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id }).sort("-createdAt").lean();
    const statsPromises = events.map(async (e) => {
      const totalBookings = await Ticket.countDocuments({ eventId: e._id, status: "booked" });
      const cancelled = await Ticket.countDocuments({ eventId: e._id, status: "cancelled" });
      return { ...e, stats: { totalBookings, cancelled, waitlistCount: e.waitlist?.length || 0 } };
    });
    const result = await Promise.all(statsPromises);
    res.json({ success: true, events: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getRecommended,
  getSeatStatus,
  getOrganizerEvents,
};

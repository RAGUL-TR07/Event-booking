const Feedback = require("../models/Feedback");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const { awardPoints } = require("../services/engagementService");

// POST /api/feedback
const submitFeedback = async (req, res) => {
  try {
    const { eventId, rating, review, isAnonymous } = req.body;
    if (!eventId || !rating) {
      return res.status(400).json({ success: false, message: "eventId and rating required." });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1-5." });
    }

    // Ensure user attended the event
    const ticket = await Ticket.findOne({
      userId: req.user._id,
      eventId,
      status: { $in: ["booked", "used"] },
    });
    if (!ticket) {
      return res.status(403).json({ success: false, message: "You must have a valid ticket to leave feedback." });
    }

    // Upsert feedback
    const feedback = await Feedback.findOneAndUpdate(
      { userId: req.user._id, eventId },
      { rating, review, isAnonymous: isAnonymous || false },
      { new: true, upsert: true, runValidators: true }
    );

    // Recalculate event average rating
    const event = await Event.findById(eventId);
    const existing = event.ratings.find((r) => r.user.toString() === req.user._id.toString());
    if (existing) {
      existing.value = rating;
    } else {
      event.ratings.push({ user: req.user._id, value: rating });
    }
    event.recalcRating();
    await event.save();

    // Award points for feedback
    await awardPoints(req.user._id, "feedback");

    res.status(201).json({ success: true, feedback, newAverageRating: event.averageRating });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "You already submitted feedback for this event." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/feedback/:eventId
const getEventFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ eventId: req.params.eventId, isAnonymous: false })
      .populate("userId", "name refNo")
      .sort("-createdAt")
      .lean();

    const anonCount = await Feedback.countDocuments({
      eventId: req.params.eventId,
      isAnonymous: true,
    });

    const event = await Event.findById(req.params.eventId).select("averageRating ratings");

    res.json({
      success: true,
      averageRating: event?.averageRating || 0,
      totalReviews: feedbacks.length + anonCount,
      feedbacks,
      anonymousCount: anonCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { submitFeedback, getEventFeedback };

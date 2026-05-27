const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Feedback = require("../models/Feedback");

/**
 * Recommendation score algorithm:
 *   score = (preference × 5) + (popularity × 3) + (activity × 2)
 *
 * preference  → category matches user.preferences
 * popularity  → event heatScore / views
 * activity    → user has recent views or bookmarks for this event's category
 */
const getRecommendations = async (user, limit = 10) => {
  const now = new Date();

  // Get upcoming approved events
  const events = await Event.find({
    status: "approved",
    date: { $gte: now },
    availableSeats: { $gt: 0 },
  }).lean();

  // Get user's booked event IDs to exclude
  const userTickets = await Ticket.find({ userId: user._id, status: "booked" }).select("eventId");
  const bookedIds = new Set(userTickets.map((t) => t.eventId.toString()));

  // Get user feedback (to factor in high-rated categories)
  const userFeedback = await Feedback.find({ userId: user._id })
    .populate("eventId", "category")
    .lean();
  const likedCategories = new Set(
    userFeedback.filter((f) => f.rating >= 4).map((f) => f.eventId?.category)
  );

  // Score each event
  const scored = events
    .filter((e) => !bookedIds.has(e._id.toString()))
    .map((e) => {
      const inPreferences = user.preferences?.includes(e.category) ? 1 : 0;
      const inLiked = likedCategories.has(e.category) ? 1 : 0;
      const inRecentViews = user.recentViews?.map((v) => v.toString()).includes(e._id.toString()) ? 1 : 0;
      const inBookmarks = user.bookmarkedEvents?.map((b) => b.toString()).includes(e._id.toString()) ? 1 : 0;

      const preference = Math.max(inPreferences, inLiked);
      const popularity = Math.min(e.heatScore / 100, 1); // normalized 0-1
      const activity = Math.max(inRecentViews, inBookmarks);

      const score = preference * 5 + popularity * 3 + activity * 2;

      return { ...e, _recommendScore: Math.round(score * 100) / 100 };
    })
    .sort((a, b) => b._recommendScore - a._recommendScore)
    .slice(0, limit);

  return scored;
};

module.exports = { getRecommendations };

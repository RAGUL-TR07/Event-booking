const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 1000 },
    isAnonymous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One feedback per user per event
feedbackSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);

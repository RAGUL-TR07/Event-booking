const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema({
  number: { type: String, required: true },
  isBooked: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  value: { type: Number, min: 1, max: 5, required: true },
});

const waitlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  joinedAt: { type: Date, default: Date.now },
});

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["tech", "cultural", "sports", "arts", "business", "academic", "other"],
      required: true,
    },
    tags: { type: [String], default: [] },
    date: { type: Date, required: true },
    endDate: { type: Date },
    venue: { type: String, required: true },
    totalSeats: { type: Number, required: true, min: 1 },
    availableSeats: { type: Number },
    seatLayout: [seatSchema],
    waitlist: [waitlistSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    image: { type: String, default: "" },
    ratings: [ratingSchema],
    averageRating: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    heatScore: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Initialize seats on creation
eventSchema.pre("save", async function () {
  if (this.isNew) {
    this.availableSeats = this.totalSeats;
    this.seatLayout = Array.from({ length: this.totalSeats }, (_, i) => {
      const row = String.fromCharCode(65 + Math.floor(i / 10));
      const col = (i % 10) + 1;
      // Block center seats in Row C and D (e.g. C5, C6, D5, D6)
      const isBlocked = (row === "C" && (col === 5 || col === 6)) || (row === "D" && (col === 5 || col === 6));
      return {
        number: `${row}${col}`,
        isBooked: false,
        isBlocked,
        bookedBy: null,
      };
    });
  }
});

// Recalculate average rating
eventSchema.methods.recalcRating = function () {
  if (!this.ratings.length) { this.averageRating = 0; return; }
  const sum = this.ratings.reduce((a, r) => a + r.value, 0);
  this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
};

module.exports = mongoose.model("Event", eventSchema);

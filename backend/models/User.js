const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    refNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["attendee", "organizer", "admin"],
      default: "attendee",
    },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastLoginDate: { type: Date },
    badges: { type: [String], default: [] },
    preferences: { type: [String], default: [] },
    recentViews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    bookmarkedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    attendedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    missedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);

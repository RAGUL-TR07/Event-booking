const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
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
    bookingId: { type: String, required: true, unique: true },
    bookingNumber: { type: String, required: true },
    seatNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["booked", "cancelled", "transferred", "used"],
      default: "booked",
    },
    qrCode: { type: String },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    transferredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    groupBookingId: { type: String, default: null },
    isWaitlistConversion: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent double booking same seat
ticketSchema.index({ eventId: 1, seatNumber: 1, status: 1 });
ticketSchema.index({ userId: 1, eventId: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);

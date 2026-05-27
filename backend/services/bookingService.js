const { v4: uuidv4 } = require("uuid");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { allocateSeats } = require("../utils/seatAllocator");
const { generateQR } = require("../utils/generateQR");
const { awardPoints } = require("./engagementService");

/**
 * Book a single ticket for a user.
 * Handles seat allocation, double-booking prevention, waitlist.
 * Note: No Mongoose sessions (works with standalone MongoDB, no replica set needed).
 */
const bookSingleTicket = async (userId, eventId, preferredSeats = []) => {
  const event = await Event.findOne({ _id: eventId, status: "approved" });
  if (!event) throw new Error("Event not found or not approved.");

  // Prevent double booking
  const existing = await Ticket.findOne({ userId, eventId, status: "booked" });
  if (existing) throw new Error("You have already booked this event.");

  // Time clash detection
  const clash = await detectClash(userId, event.date, event.endDate || null);
  if (clash) throw new Error(`Time clash with your existing booking: "${clash}"`);

  // Sold out → waitlist
  if (event.availableSeats <= 0) {
    const alreadyWaitlisted = event.waitlist.some((w) => w.user.toString() === userId.toString());
    if (alreadyWaitlisted) throw new Error("You are already on the waitlist for this event.");
    event.waitlist.push({ user: userId });
    await event.save();
    return { waitlisted: true, position: event.waitlist.length };
  }

  // Allocate seat
  const { success, seats, message } = allocateSeats(event, 1, preferredSeats);
  if (!success) throw new Error(message);
  const seatNumber = seats[0];

  // Mark seat booked
  const seatIdx = event.seatLayout.findIndex((s) => s.number === seatNumber);
  event.seatLayout[seatIdx].isBooked = true;
  event.seatLayout[seatIdx].bookedBy = userId;
  event.availableSeats -= 1;
  event.heatScore = Math.min(100, Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100));
  await event.save();

  // Create ticket with QR
  const bookingId = uuidv4();
  const bookingNumber = `EVT${String(event._id).slice(-4).toUpperCase()}${Date.now().toString().slice(-4)}`;
  const qrCode = await generateQR(bookingId, {
    eventId: event._id.toString(),
    userId: userId.toString(),
    seatNumber,
  });

  const ticket = await Ticket.create({ userId, eventId, bookingId, bookingNumber, seatNumber, qrCode });
  await awardPoints(userId, "booking");

  return { waitlisted: false, ticket };
};

/**
 * Group booking — validate all users, allocate consecutive seats.
 */
const bookGroupTickets = async (organizerUserId, eventId, refNos) => {
  const event = await Event.findOne({ _id: eventId, status: "approved" });
  if (!event) throw new Error("Event not found or not approved.");

  // Validate all users
  const users = await User.find({ refNo: { $in: refNos } });
  if (users.length !== refNos.length) {
    const found = users.map((u) => u.refNo);
    const missing = refNos.filter((r) => !found.includes(r));
    throw new Error(`Users not found: ${missing.join(", ")}`);
  }

  if (event.availableSeats < users.length) {
    throw new Error(`Not enough seats. Available: ${event.availableSeats}, Requested: ${users.length}`);
  }

  // Check no one already booked
  for (const u of users) {
    const exists = await Ticket.findOne({ userId: u._id, eventId, status: "booked" });
    if (exists) throw new Error(`${u.refNo} has already booked this event.`);
  }

  const { success, seats, message } = allocateSeats(event, users.length);
  if (!success) throw new Error(message);

  const groupBookingId = uuidv4();
  const createdTickets = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const seatNumber = seats[i];

    const seatIdx = event.seatLayout.findIndex((s) => s.number === seatNumber);
    event.seatLayout[seatIdx].isBooked = true;
    event.seatLayout[seatIdx].bookedBy = u._id;

    const bookingId = uuidv4();
    const bookingNumber = `GRP${groupBookingId.slice(0, 6).toUpperCase()}${i + 1}`;
    const qrCode = await generateQR(bookingId, {
      eventId: event._id.toString(),
      userId: u._id.toString(),
      seatNumber,
    });

    const ticket = await Ticket.create({
      userId: u._id, eventId, bookingId, bookingNumber, seatNumber, qrCode, groupBookingId,
    });
    createdTickets.push(ticket);
    await awardPoints(u._id, "booking");
  }

  event.availableSeats -= users.length;
  event.heatScore = Math.min(100, Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100));
  await event.save();

  return { tickets: createdTickets, groupBookingId };
};

/**
 * Cancel ticket and FIFO auto-assign waitlist.
 */
const cancelTicket = async (userId, ticketId) => {
  const ticket = await Ticket.findOne({ _id: ticketId, userId, status: "booked" });
  if (!ticket) throw new Error("Ticket not found or already cancelled.");

  const event = await Event.findById(ticket.eventId);
  if (!event) throw new Error("Event not found.");

  // Free the seat
  const seatIdx = event.seatLayout.findIndex((s) => s.number === ticket.seatNumber);
  if (seatIdx !== -1) {
    event.seatLayout[seatIdx].isBooked = false;
    event.seatLayout[seatIdx].bookedBy = null;
  }
  event.availableSeats += 1;
  ticket.status = "cancelled";
  await ticket.save();

  // FIFO waitlist auto-assign
  let waitlistResult = null;
  if (event.waitlist.length > 0) {
    const next = event.waitlist.shift();
    event.availableSeats -= 1;

    const sIdx = event.seatLayout.findIndex((s) => !s.isBooked);
    const assignedSeat = event.seatLayout[sIdx].number;
    event.seatLayout[sIdx].isBooked = true;
    event.seatLayout[sIdx].bookedBy = next.user;

    const bookingId = uuidv4();
    const bookingNumber = `WL${Date.now().toString().slice(-6)}`;
    const qrCode = await generateQR(bookingId, {
      eventId: event._id.toString(),
      userId: next.user.toString(),
      seatNumber: assignedSeat,
    });

    await Ticket.create({
      userId: next.user, eventId: event._id, bookingId, bookingNumber,
      seatNumber: assignedSeat, qrCode, isWaitlistConversion: true,
    });

    await awardPoints(next.user, "booking");
    waitlistResult = { userId: next.user, seatNumber: assignedSeat };
  }

  await event.save();
  return { cancelled: true, waitlistAssigned: waitlistResult };
};

/**
 * Transfer a ticket to another user by Ref No.
 */
const transferTicket = async (fromUserId, ticketId, toRefNo) => {
  const toUser = await User.findOne({ refNo: toRefNo.toUpperCase() });
  if (!toUser) throw new Error(`User with Ref No ${toRefNo} not found.`);

  const ticket = await Ticket.findOne({ _id: ticketId, userId: fromUserId, status: "booked" });
  if (!ticket) throw new Error("Ticket not found or does not belong to you.");

  const existing = await Ticket.findOne({ userId: toUser._id, eventId: ticket.eventId, status: "booked" });
  if (existing) throw new Error(`${toRefNo} already has a booking for this event.`);

  ticket.status = "transferred";
  ticket.transferredTo = toUser._id;
  await ticket.save();

  const newBookingId = uuidv4();
  const newBookingNumber = `TRF${Date.now().toString().slice(-6)}`;
  const newQr = await generateQR(newBookingId, {
    eventId: ticket.eventId.toString(),
    userId: toUser._id.toString(),
    seatNumber: ticket.seatNumber,
  });

  const newTicket = await Ticket.create({
    userId: toUser._id, eventId: ticket.eventId, bookingId: newBookingId,
    bookingNumber: newBookingNumber, seatNumber: ticket.seatNumber, qrCode: newQr,
  });

  return { newTicket };
};

/**
 * Detect if a new event overlaps with user's existing bookings.
 */
const detectClash = async (userId, newDate, newEndDate) => {
  const bookedTickets = await Ticket.find({ userId, status: "booked" })
    .populate("eventId", "date endDate title");

  const newStart = new Date(newDate);
  const newEnd = newEndDate ? new Date(newEndDate) : new Date(newStart.getTime() + 2 * 60 * 60 * 1000);

  for (const t of bookedTickets) {
    if (!t.eventId) continue;
    const eStart = new Date(t.eventId.date);
    const eEnd = t.eventId.endDate
      ? new Date(t.eventId.endDate)
      : new Date(eStart.getTime() + 2 * 60 * 60 * 1000);

    if (newStart < eEnd && newEnd > eStart) return t.eventId.title;
  }
  return null;
};

module.exports = { bookSingleTicket, bookGroupTickets, cancelTicket, transferTicket, detectClash };

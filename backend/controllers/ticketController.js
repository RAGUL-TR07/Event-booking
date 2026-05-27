const Ticket = require("../models/Ticket");
const {
  bookSingleTicket,
  bookGroupTickets,
  cancelTicket,
  transferTicket,
} = require("../services/bookingService");

// POST /api/tickets/book
const bookTicket = async (req, res) => {
  try {
    const { eventId, preferredSeats } = req.body;
    if (!eventId) return res.status(400).json({ success: false, message: "eventId required." });

    // Only attendees can book tickets
    if (req.user.role !== "attendee") {
      return res.status(403).json({ success: false, message: "Only attendees can book tickets. Admins and organizers manage events, not book them." });
    }

    const result = await bookSingleTicket(req.user._id, eventId, preferredSeats || []);

    if (result.waitlisted) {
      return res.status(200).json({
        success: true,
        waitlisted: true,
        position: result.position,
        message: "Seats full. Added to waitlist.",
      });
    }

    res.status(201).json({ success: true, waitlisted: false, ticket: result.ticket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/tickets/group-book
const groupBookTicket = async (req, res) => {
  try {
    const { eventId, refNos } = req.body;
    if (!eventId || !Array.isArray(refNos) || refNos.length === 0) {
      return res.status(400).json({ success: false, message: "eventId and refNos[] required." });
    }

    // Only attendees can group-book
    if (req.user.role !== "attendee") {
      return res.status(403).json({ success: false, message: "Only attendees can book tickets." });
    }

    if (refNos.length > 20) {
      return res.status(400).json({ success: false, message: "Max 20 users per group booking." });
    }

    const result = await bookGroupTickets(req.user._id, eventId, refNos.map((r) => r.toUpperCase()));
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/tickets/cancel
const cancelUserTicket = async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ success: false, message: "ticketId required." });

    const result = await cancelTicket(req.user._id, ticketId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/tickets/transfer
const transferUserTicket = async (req, res) => {
  try {
    const { ticketId, toRefNo } = req.body;
    if (!ticketId || !toRefNo) {
      return res.status(400).json({ success: false, message: "ticketId and toRefNo required." });
    }

    const result = await transferTicket(req.user._id, ticketId, toRefNo);
    res.json({ success: true, newTicket: result.newTicket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/tickets/my
const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id })
      .populate("eventId", "title date venue image category status")
      .sort("-createdAt")
      .lean();

    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/tickets/scan  — Admin/Organizer validates QR
const scanTicket = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId required." });

    const ticket = await Ticket.findOne({ bookingId })
      .populate("userId", "refNo name")
      .populate("eventId", "title date venue");

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
    if (ticket.isUsed) {
      return res.status(400).json({
        success: false,
        message: "Ticket already scanned.",
        usedAt: ticket.usedAt,
      });
    }
    if (ticket.status !== "booked") {
      return res.status(400).json({ success: false, message: `Ticket status: ${ticket.status}` });
    }

    ticket.isUsed = true;
    ticket.usedAt = new Date();
    ticket.status = "used";
    await ticket.save();

    res.json({ success: true, message: "Ticket validated ✅", ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { bookTicket, groupBookTicket, cancelUserTicket, transferUserTicket, getMyTickets, scanTicket };

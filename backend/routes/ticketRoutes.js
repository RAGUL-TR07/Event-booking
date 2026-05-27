const express = require("express");
const {
  bookTicket,
  groupBookTicket,
  cancelUserTicket,
  transferUserTicket,
  getMyTickets,
  scanTicket,
} = require("../controllers/ticketController");
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.post("/book", bookTicket);
router.post("/group-book", groupBookTicket);
router.post("/cancel", cancelUserTicket);
router.post("/transfer", transferUserTicket);
router.get("/my", getMyTickets);
router.post("/scan", requireRole("admin", "organizer"), scanTicket);

module.exports = router;

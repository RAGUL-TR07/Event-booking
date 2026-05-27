const express = require("express");
const {
  getProfile,
  updateProfile,
  getActivity,
  toggleBookmark,
  getLeaderboard,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/activity", getActivity);
router.post("/bookmark", toggleBookmark);

module.exports = router;

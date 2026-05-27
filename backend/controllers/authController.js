const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { updateStreak } = require("../services/engagementService");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "college_events_secret_2026", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { refNo, password } = req.body;
    if (!refNo || !password) {
      return res.status(400).json({ success: false, message: "Ref No and password are required." });
    }

    const user = await User.findOne({ refNo: refNo.toUpperCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Update streak on login
    await updateStreak(user._id);

    const token = signToken(user._id);
    const fresh = await User.findById(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: fresh._id,
        refNo: fresh.refNo,
        name: fresh.name,
        email: fresh.email,
        role: fresh.role,
        points: fresh.points,
        streak: fresh.streak,
        badges: fresh.badges,
        preferences: fresh.preferences,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/register (admin/seeding use)
const register = async (req, res) => {
  try {
    const { refNo, password, name, email, role, preferences } = req.body;
    const existing = await User.findOne({ refNo: refNo?.toUpperCase() });
    if (existing) return res.status(409).json({ success: false, message: "Ref No already registered." });

    const user = await User.create({ refNo, password, name, email, role, preferences });
    const token = signToken(user._id);

    res.status(201).json({ success: true, token, user: { id: user._id, refNo: user.refNo, role: user.role } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { login, register };

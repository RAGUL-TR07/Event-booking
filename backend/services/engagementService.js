const User = require("../models/User");

const POINTS = { booking: 10, attending: 20, feedback: 5 };

const BADGES = [
  { id: "first_booking", label: "First Booking", condition: (u) => u.attendedEvents?.length >= 1 },
  { id: "five_events", label: "Event Veteran", condition: (u) => u.attendedEvents?.length >= 5 },
  { id: "ten_events", label: "Campus Legend", condition: (u) => u.attendedEvents?.length >= 10 },
  { id: "streak_7", label: "7-Day Streak 🔥", condition: (u) => u.streak >= 7 },
  { id: "streak_30", label: "30-Day Streak 🏆", condition: (u) => u.streak >= 30 },
  { id: "top_reviewer", label: "Top Reviewer ⭐", condition: (u) => (u.reviewCount || 0) >= 10 },
];

/**
 * Award points to a user for a given action.
 * @param {string} userId
 * @param {"booking" | "attending" | "feedback"} action
 */
const awardPoints = async (userId, action) => {
  const pts = POINTS[action] || 0;
  if (!pts) return;

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { points: pts } },
    { new: true }
  );

  await checkBadges(user);
  return user;
};

/**
 * Update streak on daily login/participation.
 * @param {string} userId
 */
const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
  if (lastLogin) lastLogin.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = user.streak;
  if (!lastLogin || lastLogin.getTime() < yesterday.getTime()) {
    newStreak = 1; // broken or first time
  } else if (lastLogin.getTime() === yesterday.getTime()) {
    newStreak += 1; // consecutive day
  }
  // same day → no change to streak count

  await User.findByIdAndUpdate(userId, {
    streak: newStreak,
    lastLoginDate: new Date(),
  });

  await checkBadges(await User.findById(userId));
};

/**
 * Check and award badges based on current user state.
 * @param {object} user - Mongoose user document
 */
const checkBadges = async (user) => {
  if (!user) return;
  const earned = [];
  for (const badge of BADGES) {
    if (!user.badges.includes(badge.id) && badge.condition(user)) {
      earned.push(badge.id);
    }
  }
  if (earned.length > 0) {
    await User.findByIdAndUpdate(user._id, { $addToSet: { badges: { $each: earned } } });
  }
};

module.exports = { awardPoints, updateStreak, checkBadges, POINTS, BADGES };

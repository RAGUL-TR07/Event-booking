/**
 * Database Seeder
 * Run: node server/seed.js
 *
 * Seeds the database with:
 * - Sample users (attendees, organizers, admin)
 * - Sample events (covering all categories)
 */

require("dotenv").config({ path: __dirname + "/.env" });
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Event = require("./models/Event");
const Ticket = require("./models/Ticket");
const Feedback = require("./models/Feedback");

const users = [
  {
    refNo: "ADMIN001",
    password: "admin123",
    name: "Admin User",
    email: "admin@college.edu",
    role: "admin",
    preferences: ["tech", "academic"],
    points: 500,
    streak: 10,
  },
  {
    refNo: "ORG001",
    password: "organizer123",
    name: "Ragul Organizer",
    email: "ragul@college.edu",
    role: "organizer",
    preferences: ["tech", "cultural"],
    points: 320,
    streak: 5,
  },
  {
    refNo: "ORG002",
    password: "organizer123",
    name: "Ragul Events",
    email: "ragul@college.edu",
    role: "organizer",
    preferences: ["sports", "cultural"],
    points: 210,
    streak: 3,
  },
  {
    refNo: "STU001",
    password: "student123",
    name: "Ragul T R",
    email: "ragul@college.edu",
    role: "attendee",
    preferences: ["tech", "business"],
    points: 1240,
    streak: 7,
    badges: ["first_booking", "five_events"],
  },
  {
    refNo: "STU002",
    password: "student123",
    name: "Prawin",
    email: "prawin@college.edu",
    role: "attendee",
    preferences: ["cultural", "arts"],
    points: 890,
    streak: 4,
    badges: ["first_booking"],
  },
  {
    refNo: "STU003",
    password: "student123",
    name: "Bavan",
    email: "bavan@college.edu",
    role: "attendee",
    preferences: ["sports"],
    points: 450,
    streak: 2,
  },
  {
    refNo: "STU004",
    password: "student123",
    name: "Dharsh",
    email: "dharsh@college.edu",
    role: "attendee",
    preferences: ["tech", "academic"],
    points: 670,
    streak: 6,
  },
];

const getEventsSeed = (organizerId) => [
  {
    title: "TechFest 2026 — AI & Robotics Summit",
    description:
      "Annual flagship tech festival featuring keynotes, robotics demos, hackathons and AI startup showcase. Join 300+ engineers and innovators.",
    category: "tech",
    tags: ["AI", "robotics", "hackathon", "startup"],
    date: new Date("2026-06-12T18:00:00"),
    endDate: new Date("2026-06-12T22:00:00"),
    venue: "Main Auditorium, Block A",
    totalSeats: 300,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 92,
    views: 1240,
  },
  {
    title: "Cultural Night — Rhythms of India",
    description:
      "An electric evening of music, dance and performances by student bands. Featuring classical, folk and fusion genres.",
    category: "cultural",
    tags: ["music", "dance", "cultural"],
    date: new Date("2026-06-20T19:30:00"),
    endDate: new Date("2026-06-20T23:00:00"),
    venue: "Open Air Theatre",
    totalSeats: 600,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 78,
    views: 960,
  },
  {
    title: "Entrepreneurship Bootcamp",
    description:
      "Two-day intensive bootcamp with founders, VCs and product mentors. Build your MVP pitch in 48 hours.",
    category: "business",
    tags: ["startup", "entrepreneurship", "VC"],
    date: new Date("2026-07-02T10:00:00"),
    endDate: new Date("2026-07-03T18:00:00"),
    venue: "Innovation Hub",
    totalSeats: 120,
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 55,
    views: 430,
  },
  {
    title: "Inter-College Football Cup",
    description:
      "16 colleges, one trophy. Cheer for your team in the biggest inter-college football tournament of the year.",
    category: "sports",
    tags: ["football", "tournament", "sports"],
    date: new Date("2026-06-28T16:00:00"),
    endDate: new Date("2026-06-28T20:00:00"),
    venue: "Sports Ground",
    totalSeats: 800,
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 81,
    views: 1100,
  },
  {
    title: "Art & Photography Expo",
    description:
      "Student-curated exhibits exploring identity, place and memory through paintings, sculptures and photography.",
    category: "arts",
    tags: ["art", "photography", "exhibition"],
    date: new Date("2026-07-10T11:00:00"),
    endDate: new Date("2026-07-10T18:00:00"),
    venue: "Gallery Hall",
    totalSeats: 200,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 47,
    views: 320,
  },
  {
    title: "Open Mic Night",
    description:
      "Poetry, stand-up comedy, acoustic sets — sign up at the door. All genres welcome!",
    category: "cultural",
    tags: ["open-mic", "comedy", "music"],
    date: new Date("2026-06-15T20:00:00"),
    endDate: new Date("2026-06-15T23:00:00"),
    venue: "Cafe Block",
    totalSeats: 80,
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 35,
    views: 180,
  },
  {
    title: "Machine Learning Workshop",
    description:
      "Hands-on workshop covering regression, neural networks, and deploying ML models. Bring your laptop!",
    category: "tech",
    tags: ["ML", "AI", "workshop", "Python"],
    date: new Date("2026-07-05T09:00:00"),
    endDate: new Date("2026-07-05T17:00:00"),
    venue: "CS Lab, Block C",
    totalSeats: 50,
    image: "https://images.unsplash.com/photo-1527474305487-b87b222841cc?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 68,
    views: 560,
  },
  {
    title: "Annual Academic Conclave",
    description:
      "Faculty presentations, student research papers, and panel discussions on emerging academic trends.",
    category: "academic",
    tags: ["research", "academic", "conference"],
    date: new Date("2026-07-20T09:00:00"),
    endDate: new Date("2026-07-20T17:00:00"),
    venue: "Seminar Hall B",
    totalSeats: 150,
    image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=900",
    status: "approved",
    createdBy: organizerId,
    heatScore: 40,
    views: 210,
  },
];

const seed = async () => {
  try {
    await connectDB();

    console.log("🗑️  Clearing existing data...");
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Ticket.deleteMany({}),
      Feedback.deleteMany({}),
    ]);

    console.log("👤 Creating users...");
    const createdUsers = await User.create(users);
    const organizer = createdUsers.find((u) => u.refNo === "ORG001");
    console.log(`   ✅ ${createdUsers.length} users created`);

    console.log("📅 Creating events...");
    const eventsSeed = getEventsSeed(organizer._id);
    // Must save one-by-one to trigger pre-save hook for seat layout
    const createdEvents = [];
    for (const ev of eventsSeed) {
      const event = await Event.create(ev);
      createdEvents.push(event);
    }
    console.log(`   ✅ ${createdEvents.length} events created`);

    console.log("\n✨ Database seeded successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔑 Login Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👑 Admin   → ADMIN001 / admin123");
    console.log("🎪 Organizer → ORG001 / organizer123");
    console.log("🎓 Student  → STU001 / student123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
};

seed();

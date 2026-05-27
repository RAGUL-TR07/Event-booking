const mongoose = require("mongoose");
const dns = require("dns");

// Force Node.js to use a robust list of public DNS servers (supporting both IPv6/DNS64 and IPv4)
try {
  dns.setServers([
    "2001:4860:4860::6464", // Google DNS64 (required for your network)
    "2001:4860:4860::8888", // Google Public DNS (IPv6)
    "8.8.8.8",              // Google Public DNS (IPv4)
    "1.1.1.1",              // Cloudflare DNS (IPv4)
  ]);
} catch (err) {
  console.warn("⚠️ DNS configuration warning:", err.message);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/event_booking"
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

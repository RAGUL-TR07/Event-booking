const QRCode = require("qrcode");

/**
 * Generates a QR code as a base64 data URL.
 * @param {string} bookingId - Unique booking ID to encode
 * @param {object} meta - Additional metadata (eventId, userId, seatNumber)
 * @returns {Promise<string>} - data URL string
 */
const generateQR = async (bookingId, meta = {}) => {
  const payload = JSON.stringify({
    bookingId,
    eventId: meta.eventId,
    userId: meta.userId,
    seat: meta.seatNumber,
    generatedAt: new Date().toISOString(),
  });

  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#111827", light: "#FFFFFF" },
  });

  return qrDataUrl;
};

module.exports = { generateQR };

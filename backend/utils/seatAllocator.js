/**
 * Allocates the best available seats from the event's seat layout.
 * Returns seats in order (row by row) and handles multi-seat group requests.
 *
 * @param {object} event - Mongoose event document
 * @param {number} count - Number of seats to allocate
 * @param {string[]} preferredSeats - Optional preferred seat numbers
 * @returns {{ seats: string[], success: boolean, message: string }}
 */
const allocateSeats = (event, count = 1, preferredSeats = []) => {
  const available = event.seatLayout.filter((s) => !s.isBooked);

  if (available.length < count) {
    return {
      success: false,
      seats: [],
      message: `Only ${available.length} seats available, ${count} requested.`,
    };
  }

  // Try preferred seats first
  if (preferredSeats.length > 0) {
    const preferred = available.filter((s) => preferredSeats.includes(s.number));
    if (preferred.length >= count) {
      return { success: true, seats: preferred.slice(0, count).map((s) => s.number), message: "ok" };
    }
  }

  // Allocate consecutive seats where possible (better UX for groups)
  if (count > 1) {
    const groups = [];
    let run = [available[0]];
    for (let i = 1; i < available.length; i++) {
      const prev = available[i - 1].number;
      const curr = available[i].number;
      // Check same row, consecutive column
      if (prev[0] === curr[0] && parseInt(curr.slice(1)) === parseInt(prev.slice(1)) + 1) {
        run.push(available[i]);
      } else {
        groups.push(run);
        run = [available[i]];
      }
    }
    groups.push(run);
    const consecutive = groups.find((g) => g.length >= count);
    if (consecutive) {
      return { success: true, seats: consecutive.slice(0, count).map((s) => s.number), message: "ok" };
    }
  }

  // Fallback: pick first N available
  return { success: true, seats: available.slice(0, count).map((s) => s.number), message: "ok" };
};

module.exports = { allocateSeats };

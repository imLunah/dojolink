// When the centers are open. One table for all three: Monday to Friday
// 3 to 7, Saturday 10 to 2, closed Sunday. Hours are 24h, [open, close).
//
// The parent home's live schedule draws one bar per open hour and counts, in
// each, every ninja whose hour in the building touched it. Nothing needs
// clamping any more: a 6:40 arrival stays in the building past closing on
// paper, but the only bar its hour can touch is the 6 o'clock one, because
// that is the last bar there is.

export const OPEN_HOURS = {
  1: [15, 19], 2: [15, 19], 3: [15, 19], 4: [15, 19], 5: [15, 19],
  6: [10, 14],
};

// { open, close } for a Date, or null on a closed day.
export function hoursFor(date) {
  const h = OPEN_HOURS[date.getDay()];
  return h ? { open: h[0], close: h[1] } : null;
}

// The hour-long slots of an open day, by starting hour. [] when closed.
export function slotsFor(date) {
  const h = hoursFor(date);
  if (!h) return [];
  return Array.from({ length: h.close - h.open }, (_, i) => h.open + i);
}

// 15 -> "3 PM", 12 -> "12 PM", 10 -> "10 AM".
export function fmtHour(h) {
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${h < 12 ? 'AM' : 'PM'}`;
}

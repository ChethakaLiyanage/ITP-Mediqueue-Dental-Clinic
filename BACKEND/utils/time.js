// Utils/time.js (NEW)
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseHHMM(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function fromDateTimeYMD_HM(dateStr, hhmm) {
  const t = parseHHMM(hhmm);
  if (!t) return null;
  const base = new Date(`${dateStr}T00:00:00.000Z`);
  return new Date(base.getTime() + (t.h * 60 + t.m) * 60 * 1000);
}

function addMinutes(d, m) { return new Date(d.getTime() + m * 60000); }

function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function getDayNameUTC(dateStr) {
  const noon = new Date(`${dateStr}T12:00:00.000Z`); // avoid DST edges
  return DAY_NAMES[noon.getUTCDay()];
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function dayStartUTC(dateStr) { return new Date(`${dateStr}T00:00:00.000Z`); }
function dayEndUTC(dateStr)   { return new Date(`${dateStr}T23:59:59.999Z`); }

module.exports = {
  parseHHMM,
  fromDateTimeYMD_HM,
  addMinutes,
  minutesBetween,
  getDayNameUTC,
  overlap,
  dayStartUTC,
  dayEndUTC,
};

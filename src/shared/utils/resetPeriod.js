// Reset-period helpers shared between server (limitRepo) and client (dashboard).
// Pure functions, no Node/browser dependencies.
//
// Fixed windows are epoch-aligned buckets: the same window length always starts
// at the same wall-clock boundary (e.g. 7d -> every Monday 00:00 UTC), so a
// stored periodStart from an earlier call is directly comparable with the
// current window start — lazy reset needs no extra state.
const WINDOW_RE = /^(\d+)\s*([hd])$/;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Epoch-aligned bucket start for a fixed window (e.g. "7d", "5h").
export function fixedWindowStart(resetPeriod, now = Date.now()) {
  const m = WINDOW_RE.exec(String(resetPeriod || "").trim().toLowerCase());
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  const windowMs = m[2] === "h" ? n * HOUR_MS : n * DAY_MS;
  return Math.floor(now / windowMs) * windowMs;
}

// Canonical start-of-period timestamp (ISO) for a pool reset period.
// Fixed windows are epoch-aligned; legacy calendar periods keep their original
// semantics (daily = UTC midnight, weekly = Monday 00:00 UTC, monthly = 1st).
export function periodStart(resetPeriod, now = Date.now()) {
  const fixed = fixedWindowStart(resetPeriod, now);
  if (fixed !== null) return new Date(fixed).toISOString();
  const d = new Date(now);
  if (resetPeriod === "daily") {
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (resetPeriod === "weekly") {
    // UTC Monday start (dayOfWeek 0==Sunday..6==Saturday)
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  // monthly
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Human label for a stored resetPeriod ("5h" -> "5 hours", "weekly" -> "Weekly").
export function formatResetPeriod(resetPeriod) {
  const fixed = fixedWindowStart(resetPeriod);
  if (fixed !== null) {
    const m = WINDOW_RE.exec(String(resetPeriod || "").trim().toLowerCase());
    const n = Number(m[1]);
    const unit = m[2] === "h" ? "hour" : "day";
    return `${n} ${unit}${n === 1 ? "" : "s"}`;
  }
  const labels = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  return labels[resetPeriod] || String(resetPeriod || "monthly");
}

// Options for the Reset Period dropdown (value -> label), ordered newest first.
export const RESET_PERIOD_OPTIONS = [
  { value: "5h", label: "5 hours" },
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "daily", label: "Daily (calendar)" },
  { value: "weekly", label: "Weekly (calendar)" },
  { value: "monthly", label: "Monthly (calendar)" },
];
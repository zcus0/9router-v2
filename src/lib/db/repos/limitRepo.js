// Per-key usage limits + shared quota pools.
// Additive schema v2 — see src/lib/db/schema.js (apiKeys.*Limit columns, quotaPools table).
import { getAdapter } from "../driver.js";
import { parseJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";

// ─── Windows (RPM/TPM + daily token/cost usage) ─────────────────────────────
// Sliding windows are too expensive per-request (hundreds of kv writes).
// Instead we use coarse fixed windows: 1-minute (RPM/TPM) and 1-day (daily caps).
// Trade-off: a key can peek slightly past its RPM between window edges — bounded
// by one window, acceptable for a single-VPS gateway. Upgrade path: move these to
// a dedicated counter table / sliding log when a single deploy outgrows it.
export const WINDOW_MS = {
  minute: 60_000,
  day: 24 * 60 * 60_000,
};

const limitsKv = makeKv("apiKeyLimits");

function windowStart(window, now = Date.now()) {
  return now - (now % window);
}

// Aggregate today's per-key usage (tokens+cost) from usageDaily.
// usageDaily.data.byApiKey is keyed `${apiKeyVal}|${model}|${provider}` where
// apiKeyVal is the raw key string — map it to keyId via the apiKeys table.
let _keyIdCache = null;
let _keyIdCacheTs = 0;
async function apiKeyIdByName(db, keyName) {
  if (Date.now() - _keyIdCacheTs > 30_000) {
    _keyIdCache = new Map();
    try {
      for (const r of db.all(`SELECT id, key FROM apiKeys`)) _keyIdCache.set(r.key, r.id);
    } catch {}
    _keyIdCacheTs = Date.now();
  }
  return _keyIdCache.get(keyName);
}

export async function getKeyDailyUsage(keyId, dateKey) {
  const db = await getAdapter();
  const row = db.get(`SELECT data FROM usageDaily WHERE dateKey = ?`, [dateKey]);
  if (!row) return { tokens: 0, cost: 0 };
  const byApiKey = parseJson(row.data, {}).byApiKey;
  if (!byApiKey || typeof byApiKey !== "object") return { tokens: 0, cost: 0 };

  let tokens = 0;
  let cost = 0;
  for (const [akKey, c] of Object.entries(byApiKey)) {
    const [keyVal] = akKey.split("|");
    const id = await apiKeyIdByName(db, keyVal);
    if (id === keyId) {
      tokens += (c.promptTokens || 0) + (c.completionTokens || 0) + (c.cachedTokens || 0);
      cost += c.cost || 0;
    }
  }
  return { tokens, cost };
}

// ─── Rate-limit state (persisted, restart-safe) ─────────────────────────────
// One kv row per key per window. Expired rows reset lazily on read/write.
export async function getLimitState(keyId, window, now = Date.now()) {
  const state = (await limitsKv.get(`${keyId}:${window}`)) || {};
  const start = windowStart(window, now);
  if ((state.windowStart || 0) !== start) {
    return { windowStart: start, requests: 0, promptTokens: 0, completionTokens: 0, tokens: 0, cost: 0 };
  }
  return state;
}

export async function recordLimitUsage(keyId, usage, now = Date.now()) {
  const window = usage.window || WINDOW_MS.minute;
  const state = await getLimitState(keyId, window, now);
  const start = windowStart(window, now);
  state.windowStart = start;
  state.requests = (state.requests || 0) + (usage.requests || 1);
  state.promptTokens = (state.promptTokens || 0) + (usage.promptTokens || 0);
  state.completionTokens = (state.completionTokens || 0) + (usage.completionTokens || 0);
  state.tokens = (state.tokens || 0) + (usage.tokens || 0);
  state.cost = (state.cost || 0) + (usage.cost || 0);
  await limitsKv.set(`${keyId}:${window}`, state);
}

// ─── Enforcement ────────────────────────────────────────────────────────────
// Returns null if allowed, or { status: 429, headers, retryAfter, limit, message, body }.
export async function enforceKeyLimits({ keyId, limits, estimatedTokens = 0, estimatedCost = 0, now = Date.now() }) {
  // RPM/TPM check against persisted 1-minute buckets
  const minute = await getLimitState(keyId, WINDOW_MS.minute, now);
  const rpmUsed = minute.requests || 0;
  const tpmUsed = (minute.promptTokens || 0) + (minute.completionTokens || 0);
  if (limits.rpmLimit && rpmUsed >= limits.rpmLimit) {
    const retryAfter = Math.ceil((WINDOW_MS.minute - (now - minute.windowStart)) / 1000);
    return limited({ limit: "rpm", current: rpmUsed, max: limits.rpmLimit, retryAfter, now });
  }
  if (limits.tpmLimit && tpmUsed + estimatedTokens >= limits.tpmLimit) {
    const retryAfter = Math.ceil((WINDOW_MS.minute - (now - minute.windowStart)) / 1000);
    return limited({ limit: "tpm", current: tpmUsed, max: limits.tpmLimit, retryAfter, now });
  }

  // Daily aggregate caps (tokens + cost) from usageDaily
  const dateKey = nowDateKey(now);
  const daily = await getKeyDailyUsage(keyId, dateKey);
  if (limits.dailyTokensLimit && daily.tokens + estimatedTokens >= limits.dailyTokensLimit) {
    return limited({ limit: "dailyTokens", current: daily.tokens, max: limits.dailyTokensLimit, retryAfter: 0, now });
  }
  if (limits.dailyCostLimit && daily.cost + estimatedCost >= limits.dailyCostLimit) {
    return limited({ limit: "dailyCost", current: daily.cost, max: limits.dailyCostLimit, retryAfter: 0, now });
  }

  // Shared quota pool caps (token + cost), decremented per request
  if (limits.poolId) {
    const pool = await getPool(limits.poolId);
    if (pool) {
      const pState = await getPoolUsage(pool.id, pool.resetPeriod, now);
      const poolRemainingTokens = pool.tokenLimit != null ? Math.max(0, pool.tokenLimit - pState.tokens) : null;
      const poolRemainingCost = pool.costLimit != null ? Math.max(0, pool.costLimit - pState.cost) : null;
      if (poolRemainingTokens !== null && estimatedTokens > poolRemainingTokens) {
        return limited({ limit: "poolTokens", current: pState.tokens, max: pool.tokenLimit, retryAfter: 0, now, pool });
      }
      if (poolRemainingCost !== null && estimatedCost > poolRemainingCost) {
        return limited({ limit: "poolCost", current: pState.cost, max: pool.costLimit, retryAfter: 0, now, pool });
      }
    }
  }

  return null;
}

function limited({ limit, current, max, retryAfter, now, pool }) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-RateLimit-Limit": String(max || 0),
    "X-RateLimit-Remaining": String(Math.max(0, (max || 0) - current)),
    "X-RateLimit-Reset": String(Math.ceil(now / 1000) + retryAfter),
    "X-RateLimit-Limit-Used": String(current),
  };
  if (retryAfter > 0) headers["Retry-After"] = String(retryAfter);
  return {
    status: 429,
    headers,
    retryAfter,
    limit,
    message: `Rate limit exceeded: ${limit} (${current}/${max}${pool ? ` in pool ${pool.name}` : ""})`,
    body: {
      error: {
        message: `Rate limit exceeded: ${limit}${pool ? ` in pool ${pool.name}` : ""}`,
        type: "rate_limit_error",
        code: "rate_limit_exceeded",
      },
    },
  };
}

export function nowDateKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function poolPeriodStart(resetPeriod, now = Date.now()) {
  const d = new Date(now);
  if (resetPeriod === "daily") {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (resetPeriod === "weekly") {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  // monthly (default)
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const poolUsageKv = makeKv("quotaPoolUsage");

// Pool usage counter for the current period. Reset lazily when period rolls over.
export async function getPoolUsage(poolId, resetPeriod = "monthly", now = Date.now()) {
  const state = (await poolUsageKv.get(poolId)) || { tokens: 0, cost: 0, periodStart: null };
  const periodStart = poolPeriodStart(resetPeriod, now);
  if (state.periodStart !== periodStart) {
    return { tokens: 0, cost: 0, periodStart };
  }
  return state;
}

// Decrement pool usage after a request completes (called by usageRepo).
export async function recordPoolUsage(poolId, usage, resetPeriod = "monthly", now = Date.now()) {
  if (!poolId) return null;
  const state = await getPoolUsage(poolId, resetPeriod, now);
  state.tokens += usage.tokens || 0;
  state.cost += usage.cost || 0;
  await poolUsageKv.set(poolId, state);
  return state;
}

// ─── Pool CRUD ──────────────────────────────────────────────────────────────
export async function getPools() {
  const db = await getAdapter();
  return db.all(`SELECT * FROM quotaPools ORDER BY createdAt ASC`);
}

export async function getPool(id) {
  if (!id) return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM quotaPools WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tokenLimit: row.tokenLimit ?? null,
    costLimit: row.costLimit ?? null,
    resetPeriod: row.resetPeriod || "monthly",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createPool({ name, tokenLimit = null, costLimit = null, resetPeriod = "monthly" }) {
  const db = await getAdapter();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO quotaPools(id, name, tokenLimit, costLimit, resetPeriod, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [id, name, tokenLimit ?? null, costLimit ?? null, resetPeriod || "monthly", now, now]
  );
  return getPool(id);
}

export async function updatePool(id, data) {
  const existing = await getPool(id);
  if (!existing) return null;
  const db = await getAdapter();
  const merged = { ...existing, ...data };
  db.run(
    `UPDATE quotaPools SET name = ?, tokenLimit = ?, costLimit = ?, resetPeriod = ?, updatedAt = ? WHERE id = ?`,
    [merged.name, merged.tokenLimit ?? null, merged.costLimit ?? null, merged.resetPeriod || "monthly", new Date().toISOString(), id]
  );
  return getPool(id);
}

export async function deletePool(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM quotaPools WHERE id = ?`, [id]);
  if ((res?.changes ?? 0) > 0) {
    // Release keys referencing the pool
    db.run(`UPDATE apiKeys SET quotaPoolId = NULL WHERE quotaPoolId = ?`, [id]);
    await poolUsageKv.remove(id);
  }
  return (res?.changes ?? 0) > 0;
}
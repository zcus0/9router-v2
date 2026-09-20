// Limit enforcement + shared quota pools (schema v2): rpm/tpm windows,
// daily caps via usageDaily, pool decrement + cap, CRUD round-trips.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-limits-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
});

afterEach(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("Quota pools CRUD", () => {
  it("creates/updates/deletes pools and returns usage", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Monthly", tokenLimit: 1000, costLimit: 5, resetPeriod: "monthly" });
    expect(pool.id).toBeTruthy();
    expect(pool.tokenLimit).toBe(1000);

    const listed = await db.getPools();
    expect(listed.length).toBe(1);

    await db.recordPoolUsage(pool.id, { tokens: 400, cost: 2 }, "monthly");
    const usage = await db.getPoolUsage(pool.id, "monthly");
    expect(usage.tokens).toBe(400);
    expect(usage.cost).toBe(2);

    const updated = await db.updatePool(pool.id, { tokenLimit: 500 });
    expect(updated.tokenLimit).toBe(500);

    expect(await db.deletePool(pool.id)).toBe(true);
    expect(await db.getPool(pool.id)).toBeNull();
  });

  it("resets pool usage lazily when the period rolls over", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Daily", resetPeriod: "daily" });
    const now = Date.now();

    await db.recordPoolUsage(pool.id, { tokens: 100, cost: 0 }, "daily", now);
    const samePeriod = await db.getPoolUsage(pool.id, "daily", now);
    expect(samePeriod.tokens).toBe(100);

    // Next day: period rolled → counter resets (lazy)
    const nextDay = now + 24 * 60 * 60_000;
    const rolled = await db.getPoolUsage(pool.id, "daily", nextDay);
    expect(rolled.tokens).toBe(0);
    expect(rolled.periodStart).not.toBe(samePeriod.periodStart);
  });
  it("supports fixed-window periods (5h/7d/30d) with epoch-aligned lazy reset", async () => {
    const db = await import("@/lib/db/index.js");
    const now = Date.now();

    // 7d window: same bucket accumulates, next bucket resets.
    const pool = await db.createPool({ name: "Week", resetPeriod: "7d" });
    await db.recordPoolUsage(pool.id, { tokens: 250, cost: 1 }, "7d", now);
    expect((await db.getPoolUsage(pool.id, "7d", now)).tokens).toBe(250);

    const sevenDays = now + 7 * 86_400_000;
    const rolled = await db.getPoolUsage(pool.id, "7d", sevenDays);
    expect(rolled.tokens).toBe(0);
    expect(rolled.periodStart).not.toBe((await db.getPoolUsage(pool.id, "7d", now)).periodStart);

    // 5h window: resets at the next 5h bucket boundary.
    const hour = 3_600_000;
    const pool5h = await db.createPool({ name: "FiveHours", resetPeriod: "5h" });
    await db.recordPoolUsage(pool5h.id, { tokens: 10, cost: 0 }, "5h", now);
    const past5h = now - 5 * hour;
    const earlier = await db.getPoolUsage(pool5h.id, "5h", past5h);
    expect(earlier.tokens).toBe(0); // earlier bucket → no usage recorded there

    // 30d window exists and formats.
    expect(db.formatResetPeriod("30d")).toBe("30 days");
    expect(db.formatResetPeriod("5h")).toBe("5 hours");
    expect(db.formatResetPeriod("daily")).toBe("Daily");
    expect(db.formatResetPeriod("1d")).toBe("1 day");
  });
});


describe("Key limits CRUD (schema v2 columns)", () => {
  it("persists limit columns on create and update", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "P", tokenLimit: 1000 });

    const key = await db.createApiKey("k1", "m", {
      rpmLimit: 10,
      tpmLimit: 5000,
      dailyTokensLimit: 100000,
      dailyCostLimit: 3.5,
      quotaPoolId: pool.id,
    });
    expect(key.rpmLimit).toBe(10);
    expect(key.tpmLimit).toBe(5000);
    expect(key.dailyTokensLimit).toBe(100000);
    expect(key.dailyCostLimit).toBe(3.5);
    expect(key.quotaPoolId).toBe(pool.id);

    const byKey = await db.getApiKeyByKey(key.key);
    expect(byKey.id).toBe(key.id);

    const updated = await db.updateApiKey(key.id, { rpmLimit: 5, quotaPoolId: null });
    expect(updated.rpmLimit).toBe(5);
    expect(updated.quotaPoolId).toBeNull();
  });
});

describe("enforceKeyLimits", () => {
  async function mkKey(limits) {
    const db = await import("@/lib/db/index.js");
    return db.createApiKey("k", "m", limits);
  }

  it("rejects the 3rd request in a minute when rpmLimit=2", async () => {
    const db = await import("@/lib/db/index.js");
    const key = await mkKey({ rpmLimit: 2 });
    const now = Date.now();
    const limits = { rpmLimit: 2, tpmLimit: null, dailyTokensLimit: null, dailyCostLimit: null, poolId: null };

    expect(await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 10, now })).toBeNull();
    await db.recordLimitUsage(key.id, { requests: 1, promptTokens: 10, tokens: 10 });
    expect(await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 10, now })).toBeNull();
    await db.recordLimitUsage(key.id, { requests: 1, promptTokens: 10, tokens: 10 });

    const denied = await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 10, now });
    expect(denied).not.toBeNull();
    expect(denied.status).toBe(429);
    expect(denied.limit).toBe("rpm");
    expect(denied.headers["X-RateLimit-Limit"]).toBe("2");
    expect(denied.headers["X-RateLimit-Remaining"]).toBe("0");
    expect(denied.headers["Retry-After"]).toBeTruthy();
    expect(denied.body.error.code).toBe("rate_limit_exceeded");
  });

  it("rejects when estimated tokens push TPM over its limit", async () => {
    const db = await import("@/lib/db/index.js");
    const key = await mkKey({ tpmLimit: 100 });
    const limits = { rpmLimit: null, tpmLimit: 100, dailyTokensLimit: null, dailyCostLimit: null, poolId: null };

    expect(await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 60, now: Date.now() })).toBeNull();
    await db.recordLimitUsage(key.id, { promptTokens: 60, tokens: 60 });

    const denied = await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 50, now: Date.now() + 1 });
    expect(denied?.status).toBe(429);
    expect(denied.limit).toBe("tpm");
  });

  it("falls back to usageDaily for daily token/cost caps", async () => {
    const db = await import("@/lib/db/index.js");
    const key = await mkKey({ dailyTokensLimit: 200 });
    const limits = { rpmLimit: null, tpmLimit: null, dailyTokensLimit: 200, dailyCostLimit: null, poolId: null };
    const now = Date.now();

    // Seed a usageDaily row keyed by the raw key value, as saveRequestUsage does
    const adapter = await import("@/lib/db/driver.js");
    const adb = await adapter.getAdapter();
    const dateKey = db.nowDateKey(now);
    const data = { byApiKey: { [`${key.key}|gpt-4o|openai`]: { promptTokens: 150, completionTokens: 0, cachedTokens: 0, cost: 0 } } };
    adb.run(`INSERT INTO usageDaily(dateKey, data) VALUES(?, ?) ON CONFLICT(dateKey) DO UPDATE SET data = excluded.data`,
      [dateKey, JSON.stringify(data)]);

    // 150 used + 60 estimated > 200 → denied
    const denied = await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 60, now });
    expect(denied?.status).toBe(429);
    expect(denied.limit).toBe("dailyTokens");
  });

  it("caps shared pool spend and includes pool name in the message", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Shared", tokenLimit: 100 });
    const key = await mkKey({ quotaPoolId: pool.id });
    const limits = { rpmLimit: null, tpmLimit: null, dailyTokensLimit: null, dailyCostLimit: null, poolId: pool.id };
    const now = Date.now();

    expect(await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 60, now })).toBeNull();
    await db.recordPoolUsage(pool.id, { tokens: 60, cost: 0 }, "monthly", now);

    const denied = await db.enforceKeyLimits({ keyId: key.id, limits, estimatedTokens: 50, now });
    expect(denied?.status).toBe(429);
    expect(denied.limit).toBe("poolTokens");
    expect(denied.message).toContain("Shared");
  });

  it("releases key binding when pool is deleted", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Gone", tokenLimit: 100 });
    const key = await mkKey({ quotaPoolId: pool.id });
    await db.deletePool(pool.id);

    const fresh = await db.getApiKeyByKey(key.key);
    expect(fresh.quotaPoolId).toBeNull();
  });
});
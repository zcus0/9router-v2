// getApiKeyAuthResult: key validity + per-key limit enforcement on auth path.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-auth-"));
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

describe("getApiKeyAuthResult", () => {
  it("returns 401 for missing / invalid / paused keys", async () => {
    const { getApiKeyAuthResult } = await import("@/sse/services/auth.js");
    const db = await import("@/lib/db/index.js");

    expect((await getApiKeyAuthResult(null)).status).toBe(401);
    expect((await getApiKeyAuthResult("nope")).status).toBe(401);

    const key = await db.createApiKey("k", "m");
    const paused = await db.updateApiKey(key.id, { isActive: false });
    expect(paused.isActive).toBe(false);
    expect((await getApiKeyAuthResult(key.key)).status).toBe(401);
  });

  it("allows an active unlimited key with ok:true", async () => {
    const { getApiKeyAuthResult } = await import("@/sse/services/auth.js");
    const db = await import("@/lib/db/index.js");
    const key = await db.createApiKey("k", "m");

    const res = await getApiKeyAuthResult(key.key);
    expect(res.ok).toBe(true);
  });

  it("returns 429 with rate-limit headers once the rpm window is exhausted", async () => {
    const { getApiKeyAuthResult } = await import("@/sse/services/auth.js");
    const db = await import("@/lib/db/index.js");
    const key = await db.createApiKey("k", "m", { rpmLimit: 1 });

    const first = await getApiKeyAuthResult(key.key, { estimatedTokens: 10 });
    expect(first.ok).toBe(true);

    const second = await getApiKeyAuthResult(key.key, { estimatedTokens: 10 });
    expect(second.ok).toBe(false);
    expect(second.status).toBe(429);
    expect(second.limit).toBe("rpm");
    expect(second.headers["Retry-After"]).toBeTruthy();
    expect(second.headers["X-RateLimit-Limit"]).toBe("1");
  });

  it("counts accepted requests through recordLimitUsage (auth), so RPM increments", async () => {
    const { getApiKeyAuthResult } = await import("@/sse/services/auth.js");
    const db = await import("@/lib/db/index.js");
    const key = await db.createApiKey("k", "m", { rpmLimit: 2 });

    await getApiKeyAuthResult(key.key);
    await getApiKeyAuthResult(key.key);
    const denied = await getApiKeyAuthResult(key.key);
    expect(denied.status).toBe(429);
  });
});
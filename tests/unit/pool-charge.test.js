// saveRequestUsage charges the shared quota pool post-request (schema v2).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let tempDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-pool-"));
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

describe("saveRequestUsage pool charge", () => {
  it("decrements the bound pool when the request inserts usage history", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Pooled", tokenLimit: 1000, costLimit: 10 });
    const key = await db.createApiKey("k", "m", { quotaPoolId: pool.id });

    const { saveRequestUsage } = await import("@/lib/db/repos/usageRepo.js");
    await saveRequestUsage({
      provider: "openai",
      model: "gpt-4o",
      apiKey: key.key,
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 100, completion_tokens: 50 },
      status: "ok",
    });

    const usage = await db.getPoolUsage(pool.id, "monthly");
    expect(usage.tokens).toBe(150); // 100 prompt + 50 completion
  });

  it("does not decrement the pool when the key is not pool-bound", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Unused", tokenLimit: 1000 });
    const key = await db.createApiKey("k", "m"); // no pool

    const { saveRequestUsage } = await import("@/lib/db/repos/usageRepo.js");
    await saveRequestUsage({
      provider: "openai",
      model: "gpt-4o",
      apiKey: key.key,
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 10, completion_tokens: 5 },
      status: "ok",
    });

    expect((await db.getPoolUsage(pool.id, "monthly")).tokens).toBe(0);
  });

  it("dedupe prevents double-charging the same request", async () => {
    const db = await import("@/lib/db/index.js");
    const pool = await db.createPool({ name: "Pooled", tokenLimit: 1000 });
    const key = await db.createApiKey("k", "m", { quotaPoolId: pool.id });

    const { saveRequestUsage } = await import("@/lib/db/repos/usageRepo.js");
    const entry = {
      provider: "openai",
      model: "gpt-4o",
      apiKey: key.key,
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 30, completion_tokens: 20 },
      status: "ok",
    };
    await saveRequestUsage(entry);
    await saveRequestUsage({ ...entry }); // same timestamp → deduped

    expect((await db.getPoolUsage(pool.id, "monthly")).tokens).toBe(50);
  });
});
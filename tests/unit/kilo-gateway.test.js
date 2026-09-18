/**
 * Unit tests for the Kilo Gateway keyless free provider (pi-bansos port).
 *
 * Covers what would silently break the keyless flow:
 *   - registry wiring (noAuth, free catalog, modelsFetcher, passthrough)
 *   - the full pi-bansos free-model catalog being registered
 *   - executor forcing the documented keyless `kilo-free` bearer
 *   - dashboard FREE_PROVIDERS registration
 */

import { describe, it, expect } from "vitest";

import { KiloGatewayExecutor, getExecutor } from "../../open-sse/executors/index.js";
import { PROVIDERS } from "../../open-sse/config/providers.js";
import { PROVIDER_MODELS } from "../../open-sse/providers/index.js";
import { FREE_PROVIDERS } from "../../src/shared/constants/providers.js";
import entry from "../../open-sse/providers/registry/kilo-gateway.js";

// Model ids exported by pi-bansos as the keyless KiloCode gateway free catalog.
const PI_BANSOS_FREE_IDS = [
  "kilo-auto/free",
  "stepfun/step-3.7-flash:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "dots-studio/dots-3-note-preview:free",
  "cohere/north-mini-code:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "liquid/lfm-2.5-2.6b:free",
  "poolside/laguna-s-2.1:free",
  "minimax/minimax-m3:free",
  "thinkingmachines/inkling-small:free",
  "thinkingmachines/inkling:free",
  "minimax/minimax-m2.7:free",
];

describe("kilo-gateway registry", () => {
  it("is registered as keyless no-auth", () => {
    expect(entry.id).toBe("kilo-gateway");
    expect(entry.alias).toBe("kgw");
    expect(entry.category).toBe("free");
    expect(entry.hasFree).toBe(true);
    expect(entry.noAuth).toBe(true);
    expect(entry.transport.noAuth).toBe(true);
    expect(entry.passthroughModels).toBe(true);
    expect(entry.modelsFetcher).toEqual({ url: "https://api.kilo.ai/api/gateway/models", type: "openrouter-free" });
  });

  it("lists every pi-bansos KiloCode free model", () => {
    const ids = new Set(entry.models.map((m) => m.id));
    for (const id of PI_BANSOS_FREE_IDS) expect(ids.has(id), `missing ${id}`).toBe(true);
  });

  it("exposes transport noAuth (executor noAuth gate) and model alias mapping", () => {
    expect(PROVIDERS["kilo-gateway"].noAuth).toBe(true);
    expect(PROVIDER_MODELS["kgw"].map((m) => m.id)).toContain("minimax/minimax-m3:free");
  });

  it("appears in the dashboard FREE_PROVIDERS catalog", () => {
    expect(FREE_PROVIDERS["kilo-gateway"]?.alias).toBe("kgw");
    expect(FREE_PROVIDERS["kilo-gateway"]?.noAuth).toBe(true);
  });
});

describe("KiloGatewayExecutor", () => {
  it("is the registered executor for kilo-gateway", () => {
    expect(getExecutor("kilo-gateway")).toBeInstanceOf(KiloGatewayExecutor);
    expect(getExecutor("kilo-gateway").noAuth).toBe(true);
  });

  it("forces the documented keyless bearer even without credentials", () => {
    const headers = getExecutor("kilo-gateway").buildHeaders({}, true);
    expect(headers["Authorization"]).toBe("Bearer kilo-free");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("text/event-stream");
  });

  it("overrides any stored / runtime credential bearer", () => {
    const headers = getExecutor("kilo-gateway").buildHeaders({ apiKey: "sk-secret" }, true);
    expect(headers["Authorization"]).toBe("Bearer kilo-free");
  });
});
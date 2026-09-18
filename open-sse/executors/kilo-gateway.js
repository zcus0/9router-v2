import { DefaultExecutor } from "./default.js";

// Kilo AI gateway free tier is keyless: the documented `kilo-free` bearer is
// attributed by source IP and upstream ignores real API tokens for the
// `:free` models (pi-bansos sends the same credential). Override the
// combined-auth header so no stored key is needed.
export class KiloGatewayExecutor extends DefaultExecutor {
  constructor() {
    super("kilo-gateway");
  }

  buildHeaders(credentials, stream = true, url, model) {
    const headers = super.buildHeaders(credentials || {}, stream, url, model);
    headers["Authorization"] = "Bearer kilo-free";
    return headers;
  }
}
export default {
  id: "kilo-gateway",
  alias: "kgw",
  aliases: [
    "kilo-gateway",
    "kilogateway",
  ],
  uiAlias: "kgw",
  category: "free",
  hasFree: true,
  noAuth: true,
  display: {
    name: "Kilo Gateway",
    icon: "login",
    color: "#8B5CF6",
    textIcon: "KG",
    website: "https://kilo.ai",
  },
  transport: {
    baseUrl: "https://api.kilo.ai/api/gateway/chat/completions",
    validateUrl: "https://api.kilo.ai/api/gateway/models",
    // Kilo gateway free tier is keyless (IP-attributed). The executor sends the
    // documented "kilo-free" bearer regardless of stored credentials.
    noAuth: true,
  },
  modelsFetcher: { url: "https://api.kilo.ai/api/gateway/models", type: "openrouter-free" },
  passthroughModels: true,
  models: [
    // Keyless KiloCode gateway free models (https://kilo.ai/docs/gateway).
    // Specs match the live catalog (fetched 2026-09-07, same as pi-bansos).
    { id: "kilo-auto/free", name: "Kilo Auto Free", contextLength: 256000, maxTokens: 10000 },
    { id: "kilo-auto/frontier", name: "Kilo Auto Frontier", contextLength: 1000000 },
    { id: "kilo-auto/balanced", name: "Kilo Auto Balanced", contextLength: 1000000 },
    { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash Free", contextLength: 262144, maxTokens: 262144 },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super Free", contextLength: 262144, maxTokens: 235929 },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra Free", contextLength: 1000000, maxTokens: 65536 },
    { id: "dots-studio/dots-3-note-preview:free", name: "Dots3-Note Preview Free", contextLength: 512000, maxTokens: 460800 },
    { id: "cohere/north-mini-code:free", name: "North Mini Code Free", contextLength: 256000, maxTokens: 64000 },
    { id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 Free", contextLength: 262144, maxTokens: 32768 },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron 3 Nano Omni Free", contextLength: 256000, maxTokens: 65536 },
    { id: "openrouter/free", name: "OpenRouter Free (auto)", contextLength: 200000, maxTokens: 65536 },
    { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning Free", contextLength: 1000000, maxTokens: 65536 },
    { id: "nvidia/nemotron-3.5-content-safety:free", name: "Nemotron 3.5 Content Safety Free", contextLength: 128000, maxTokens: 8192 },
    { id: "inclusionai/ling-3.0-flash-sante:free", name: "Ling 3.0 Flash Sante Free", contextLength: 262144, maxTokens: 32768 },
    { id: "inclusionai/ling-3.0-flash-fin:free", name: "Ling 3.0 Flash Fin Free", contextLength: 262144, maxTokens: 32768 },
    { id: "liquid/lfm-2.5-2.6b:free", name: "Liquid LFM 2.5 2.6B Free", contextLength: 65536, maxTokens: 8192 },
    { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1 Free", contextLength: 262144, maxTokens: 32768 },
    { id: "kwaipilot/kat-coder-pro-v2.5:free", name: "Kat Coder Pro v2.5 (Free)", contextLength: 256000 },
    { id: "minimax/minimax-m3:free", name: "MiniMax M3 Free", contextLength: 1048576, maxTokens: 943718 },
    { id: "thinkingmachines/inkling-small:free", name: "Inkling Small Free", contextLength: 1048576, maxTokens: 262144 },
    { id: "thinkingmachines/inkling:free", name: "Inkling Free", contextLength: 1048576, maxTokens: 262144 },
    { id: "minimax/minimax-m2.7:free", name: "MiniMax M2.7 Free", contextLength: 196608, maxTokens: 176947 },
  ],
};
# 9Router-v2 - FREE AI Router & Token Saver

**Never stop coding. Save 20-40% tokens with RTK + auto-fallback to FREE & cheap AI models.**

**Connect All AI Code Tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw...) to 40+ AI Providers & 100+ Models.**

[![npm](https://img.shields.io/npm/v/@zcus0/9router-v2.svg)](https://www.npmjs.com/package/@zcus0/9router-v2)
[![Downloads](https://img.shields.io/npm/dm/@zcus0/9router-v2.svg)](https://www.npmjs.com/package/@zcus0/9router-v2)
[![Docker Pulls](https://img.shields.io/docker/pulls/zcus0/9router-v2.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/zcus0/9router-v2)
[![GHCR](https://img.shields.io/badge/GHCR-zcus0%2F9router-v2-blue?logo=github)](https://github.com/zcus0/9router-v2/pkgs/container/9router-v2)
[![License](https://img.shields.io/npm/l/@zcus0/9router-v2.svg)](https://github.com/zcus0/9router-v2/blob/master/LICENSE)

[🌐 Website](https://9router.com) • [📖 Full Docs](https://github.com/zcus0/9router-v2/blob/master/README.md)

---

## 🤔 Why 9Router?

**Stop wasting money, tokens and hitting limits:**

- ❌ Subscription quota expires unused every month
- ❌ Rate limits stop you mid-coding
- ❌ Tool outputs (git diff, grep, ls...) burn tokens fast
- ❌ Expensive APIs ($20-50/month per provider)

**9Router-v2 solves this:**

- ✅ **RTK Token Saver** - Auto-compress tool_result, save 20-40% tokens
- ✅ **Maximize subscriptions** - Track quota, use every bit before reset
- ✅ **Auto fallback** - Subscription → Cheap → Free, zero downtime
- ✅ **Multi-account** - Round-robin between accounts per provider
- ✅ **Universal** - Works with any OpenAI/Claude-compatible CLI

---

## ⚡ Quick Start

**Option 1 — npm (recommended for desktop):**

```bash
npm install -g @zcus0/9router-v2
9router-v2

# Or run directly with npx
npx @zcus0/9router-v2
```

> The CLI (`9router-v2`) runs alongside the original `9router` — separate binaries, separate data dir (`~/.9router-v2`), different default port (20135).

**Option 2 — Docker (server/VPS):**

```bash
docker run -d --name 9router-v2 -p 20135:20135 \
  -v "$HOME/.9router-v2:/app/data" -e DATA_DIR=/app/data \
  zcus0/9router-v2:latest
```

Published images: [Docker Hub](https://hub.docker.com/r/zcus0/9router-v2) • [GHCR](https://github.com/zcus0/9router-v2/pkgs/container/9router-v2) (multi-platform amd64/arm64).

🎉 Dashboard opens at `http://localhost:20135`

**2. Connect a FREE provider (no signup needed):**

Dashboard → Providers → Connect **Kiro AI** (free Claude unlimited) or **OpenCode Free** (no auth) → Done!

**3. Use in your CLI tool:**

```
Claude Code/Codex/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:20135/v1
  API Key:  [copy from dashboard]
  Model:    kr/claude-sonnet-4.5
```

That's it! Start coding with FREE AI models.

---

## 🚀 CLI Options

```bash
9router-v2                    # Start with default settings
9router-v2 --port 8080        # Custom port
9router-v2 --no-browser       # Don't open browser
9router-v2 --skip-update      # Skip auto-update check
9router-v2 --help             # Show all options
```

**Dashboard**: `http://localhost:20135/dashboard`

---

## 🛠️ Supported CLI Tools

Claude-Code • OpenClaw • Codex • OpenCode • Cursor • Antigravity • Cline • Continue • Droid • Roo • Copilot • Kilo Code • Gemini CLI • Qwen Code • iFlow • Crush • Crusher • Aider

Any tool supporting OpenAI/Claude-compatible API works.

---

## 💾 Data Location

- **macOS/Linux**: `~/.9router-v2/db/data.sqlite`
- **Windows**: `%APPDATA%/9router-v2/db/data.sqlite`
- **Docker**: `/app/data/db/data.sqlite` (mount `$HOME/.9router-v2` to persist)

This is separate from the original `9router` data dir, so both can share one machine.

---

## 📚 Documentation

Full docs, advanced setup, video tutorials & development guide:

- **GitHub**: https://github.com/zcus0/9router-v2
- **Full README**: https://github.com/zcus0/9router-v2/blob/master/README.md
- **Website**: https://9router.com

---

## 🙏 Acknowledgments

- **[9Router](https://github.com/decolua/9router)** - Upstream project this fork is based on
- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** - Original Go implementation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
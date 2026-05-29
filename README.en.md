# TwT.ai

Multi-model AI chat frontend inspired by claude.ai. Switch between Claude, DeepSeek, ModelScope, and custom providers with persistent conversation history, streaming responses, per-model settings, and an Artifact system that renders interactive HTML/React/SVG views inline.

[中文文档](README.md)

![TwT.ai Screenshot](ThemeSwitch.gif)

## Features

- **Multi-model** — Claude, DeepSeek, ModelScope, and custom OpenAI-compatible providers
- **Streaming** — SSE-based real-time response rendering with RAF-throttled updates
- **Artifact system** — Model-generated React / HTML / SVG rendered in sandboxed iframes
- **Structured input** — `<ask_user>` tab-based question cards for guided information collection
- **Dual theme** — Warm Canvas light + Midnight dark, persisted to localStorage
- **Conversation history** — IndexedDB-persisted, sidebar navigation, auto-trim (50 convos, 200 msgs)
- **Per-model settings** — Temperature, max tokens, system prompt per provider
- **Copy / Edit / Retry** — Message-level controls on user bubbles
- **Debug mode** — `NEXT_PUBLIC_DEBUG` gate with unified logger + real-time DebugPanel

## Quick Start

```bash
# Clone
git clone https://github.com/Yi-07/TwT.ai.git
cd TwT.ai

# Install
pnpm install

# Configure
cp .env.example .env.local
# Edit .env.local with your API keys

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

### Built-in providers

| Provider | Env vars |
|----------|----------|
| Claude | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_BASE_URL` |
| DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |
| ModelScope | `DASHSCOPE_API_KEY`, `MODELSCOPE_MODEL` |

### Custom providers

Add a `CUSTOM_PROVIDERS` env var with a JSON array of OpenAI-compatible endpoints:

```bash
CUSTOM_PROVIDERS=[{"id":"groq","name":"Groq","type":"openai-compatible","apiKey":"gsk_xxx","baseUrl":"https://api.groq.com/openai/v1","model":"llama3-70b-8192"}]
```

Restart `pnpm dev` — no code changes needed.

### Model defaults

```bash
NEXT_PUBLIC_DEFAULT_PROVIDER=deepseek      # Active provider on first load
NEXT_PUBLIC_DEFAULT_TEMPERATURE=1          # Shared between API and Settings panel
NEXT_PUBLIC_DEFAULT_MAX_TOKENS=131072      # Shared between API and Settings panel
```

### Server-side persistence & production lockdown

See the [Deployment](#deployment) section for PostgreSQL setup and production
configuration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 + IndexedDB persist |
| Markdown | react-markdown + remark-gfm |
| Package manager | pnpm |

## Architecture

```
POST /api/chat → Provider Registry → Claude / DeepSeek / ModelScope
                                   → ReadableStream (SSE)
                                   → useStream hook (RAF-throttled)
                                   → MessageBubble (Markdown + Artifacts)
```

- **`lib/providers/`** — Model adapters. `config.ts` centralises all provider definitions. `index.ts` (server-only) creates instances by type. `registry.ts` (client-safe) exports metadata.
- **`lib/store/`** — Zustand stores: `conversation.ts` (IndexedDB), `model.ts` (localStorage).
- **`components/`** — Chat UI, sidebar, model controls, theme toggle, debug panel, artifact sandbox.
- **`lib/utils/`** — Artifact parser (state machine), `<ask_user>` parser, logger.

See [CLAUDE.md](CLAUDE.md) for detailed architecture docs and contribution guidelines.

## Commands

| Command | Description |
|---------|------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm tsc --noEmit` | Type check |
| `pnpm lint` | ESLint |

## Deployment

### Vercel (recommended)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. In **Environment Variables**, add your API keys and any config from [.env.example](.env.example)
4. Deploy — Vercel auto-detects Next.js

### Server-side persistence (optional)

To sync conversations across devices, enable PostgreSQL storage:

1. Create a free [Neon](https://neon.tech) database and run the schema:

```sql
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. Add these env vars in Vercel:

```
NEXT_PUBLIC_STORAGE_MODE=server
ACCESS_SECRET=<random-string>
NEXT_PUBLIC_ACCESS_SECRET=<same-random-string>
DATABASE_URL=postgres://...
```

3. Redeploy. Conversations now persist in PostgreSQL.

### Production lockdown

```bash
ACCESS_PASSWORD=your-password           # Optional: if set, password-gates the site
NEXT_PUBLIC_ALLOW_USER_SETTINGS=false  # Hide Settings panel from end users
NEXT_PUBLIC_DEBUG=false                # Ensure debug tools are off
```

## Vendored Dependencies

Artifact sandbox dependencies are vendored in `public/vendor/` — no external CDN calls at runtime:

| File | Source | Version |
|------|--------|---------|
| `react.umd.js` | cdnjs / React | 18.3.1 |
| `react-dom.umd.js` | cdnjs / ReactDOM | 18.3.1 |
| `babel.min.js` | cdnjs / Babel Standalone | 7.28.4 |
| `recharts.umd.js` | unpkg / Recharts | 2.15.3 |
| `lodash.umd.js` | unpkg / lodash | 4.17.21 |
| `prop-types.umd.js` | cdnjs / prop-types | — |

## License

MIT

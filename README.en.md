# TwT.ai

Multi-model AI chat frontend inspired by claude.ai. Supports Claude, DeepSeek, ModelScope, and custom OpenAI-compatible providers with an Artifact system (React / HTML / SVG sandboxed rendering), dual themes, and cross-device persistence.

[中文文档](README.md)

![Demo](ThemeSwitch.gif)

## Features

- Multi-model switching with custom OpenAI-compatible providers — no code changes
- Smooth streaming with AST-incremental rendering, inline Artifact system (React / HTML / SVG)
- KaTeX math rendering (inline `$...$` / display `$$...$$`)
- Dual themes (Warm Canvas / Midnight), conversation history persisted in IndexedDB
- Optional PostgreSQL server-side storage for multi-device sync
- Copy / Edit / Retry on user messages, structured input cards (`<ask_user>`)

## Quick Start

**Prerequisites:** Node.js >= 20, pnpm >= 9

```bash
git clone https://github.com/Yi-07/TwT.ai.git
cd TwT.ai
pnpm install
cp .env.example .env.local   # Fill in your API keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

See [.env.example](.env.example) for all options. Common variables:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `DASHSCOPE_API_KEY` | ModelScope |
| `CUSTOM_PROVIDERS` | Custom provider JSON array (see below) |
| `NEXT_PUBLIC_DEFAULT_PROVIDER` | Default provider |
| `NEXT_PUBLIC_DEFAULT_TEMPERATURE` | Default temperature |
| `NEXT_PUBLIC_DEFAULT_MAX_TOKENS` | Default max output tokens |

**Custom providers:**

```bash
CUSTOM_PROVIDERS=[{"id":"groq","name":"Groq","type":"openai-compatible","apiKey":"gsk_xxx","baseUrl":"https://api.groq.com/openai/v1","model":"llama3-70b-8192"}]
```

Restart `pnpm dev` to apply.

## Deployment

### Vercel

Push to GitHub, import the repo on Vercel, add environment variables. Auto-deploys on push.

### Cross-device sync (optional)

Create a free [Neon](https://neon.tech) database and run the schema:

```sql
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Add environment variables:

```bash
NEXT_PUBLIC_STORAGE_MODE=server
ACCESS_SECRET=<random-string>
NEXT_PUBLIC_ACCESS_SECRET=<same-as-above>
DATABASE_URL=postgres://...
```

### Production lockdown

```bash
ACCESS_PASSWORD=your-password    # Password-protect the deployment
NEXT_PUBLIC_DEBUG=false          # Disable debug tools
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 |
| Markdown | react-markdown + remark-gfm + remark-math |
| Math | KaTeX + rehype-katex |
| Package manager | pnpm |

Architecture and contribution guide: [CLAUDE.md](CLAUDE.md).

## License

MIT

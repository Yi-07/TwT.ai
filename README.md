# TwT.ai

Multi-model AI chat frontend inspired by claude.ai. Switch between Claude, DeepSeek, and future providers with persistent conversation history, streaming responses, per-model settings, and an Artifact system that renders interactive HTML/React views inline.

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Add your API keys to .env

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm tsc --noEmit` | Type check |
| `pnpm lint` | ESLint check |

## Environment Variables

See `.env.example`:

- `ANTHROPIC_API_KEY` — Claude (Anthropic)
- `DEEPSEEK_API_KEY` — DeepSeek

## Architecture

- **Providers**: `/lib/providers/` — Model adapters (only place that calls external APIs)
- **API**: `/app/api/chat/route.ts` — Single SSE streaming endpoint
- **State**: `/lib/store/` — Zustand stores (conversation, model settings)
- **Artifacts**: Rendered in sandboxed iframes via `srcdoc`, supports React (Babel), HTML, and SVG

## Vendored Dependencies

Artifact sandbox dependencies are vendored in `public/vendor/` (no CDN):

| File | Source | Version |
|------|--------|---------|
| `react.umd.js` | cdnjs / React | 18.3.1 |
| `react-dom.umd.js` | cdnjs / ReactDOM | 18.3.1 |
| `babel.min.js` | cdnjs / Babel Standalone | 7.28.4 |
| `recharts.umd.js` | unpkg / Recharts | 2.15.3 |
| `lodash.umd.js` | unpkg / lodash | 4.17.21 |

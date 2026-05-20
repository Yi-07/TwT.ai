# Development Log

## Project: TwT.ai — Multi-Model AI Chat Frontend

A chat interface inspired by claude.ai, supporting Claude and DeepSeek models
with streaming responses, conversation history, per-model settings, and an
Artifact system that renders interactive HTML/React/SVG inline.

**Tech Stack**: Next.js 15.5 (App Router), TypeScript strict, Tailwind CSS v4,
Zustand v5, pnpm

---

## Phase 1 — Scaffolding & Types

### `chore: init Next.js 15 project with TypeScript, Tailwind v4, pnpm` (7ae0f84)

Scaffolded with `create-next-app`, then downgraded from Next.js 16 to 15.5.18.
Tailwind CSS v4 configured via `@tailwindcss/postcss` plugin with `@import "tailwindcss"`
in globals.css. ESLint 9 flat config bridged with `@eslint/eslintrc` FlatCompat
for `eslint-config-next` compatibility.

Created files:
- `app/layout.tsx` — Root layout with Geist font, theme-aware CSS variables
- `app/globals.css` — Tailwind v4 imports, `@theme inline` for design tokens
- `postcss.config.mjs` — `@tailwindcss/postcss` plugin
- `tsconfig.json` — strict mode, `@/*` path alias

### `feat: add type definitions — provider, conversation, artifact` (367b09f)

Created `types/` directory with three files:
- `types/provider.ts` — `ModelProvider` interface (`stream()`, `abort()`) and `ModelOptions`
- `types/conversation.ts` — `Message` and `Conversation` types
- `types/artifact.ts` — `ArtifactType` union, `Segment` discriminated union

`types/artifact.ts` deliberately kept separate from `types/conversation.ts`
to prevent circular imports between parser, sandbox, and message components.

---

## Phase 2 — Provider Layer (Model API Adapters)

### `feat: implement ModelProvider base + DeepSeek adapter` (f8f900c)

`lib/providers/base.ts` — Abstract `BaseProvider` class:
- Shared fetch/stream/abort/signal pipeline
- `buildRequestBody()` formats messages for OpenAI-compatible endpoints
- DeepSeek and future OpenAI-compatible providers reuse this path

`lib/providers/deepseek.ts` — `DeepSeekProvider`:
- OpenAI-compatible endpoint at `https://api.deepseek.com/v1`
- Reads `DEEPSEEK_API_KEY` from environment
- Uses base class `stream()` implementation (fetch → response.body)

`lib/providers/index.ts` — Provider registry + factory:
- Maps provider IDs to constructors
- `getProvider(id)` with singleton caching
- **SERVER ONLY** — imports SDKs, never imported by client components

### `feat: implement Claude adapter` (491f560)

`lib/providers/claude.ts` — `ClaudeProvider`:
- Uses `@anthropic-ai/sdk` instead of fetch
- Overrides `stream()`: converts SDK `MessageStream` events into
  SSE-formatted `ReadableStream` chunks
- Added `setupAbort()` / `getSignal()` to `BaseProvider` for subclasses
  that override `stream()` with their own HTTP layer
- Reads `ANTHROPIC_API_KEY` from environment

### `fix: split provider registry to prevent SDK leaking into client bundle` (ebe084c)

**Critical bug**: `ModelSwitcher.tsx` imported from `lib/providers/index.ts`,
which transitively imports `@anthropic-ai/sdk`. The SDK contains Node.js
native modules (`node:child_process`) that break client-side bundling with
`UnhandledSchemeError`.

Fix:
- **New** `lib/providers/registry.ts` — Client-safe file exporting `ProviderMeta`
  type and `getProviderMetas()` with **zero SDK imports**
- `ModelSwitcher.tsx` now imports from `registry.ts` only
- `lib/providers/index.ts` re-exports registry types, keeps server-only logic
- `next.config.ts`: `serverExternalPackages: ['@anthropic-ai/sdk']`

**Rule established**: `components/` must never import `lib/providers/index.ts`;
use `lib/providers/registry.ts` for provider metadata.

### Model version configuration (7228203, 9172fe3, bfa5807)

Three follow-up commits made model selection fully configurable:
- `NEXT_PUBLIC_DEFAULT_PROVIDER` — which provider to use by default (claude | deepseek)
- `CLAUDE_MODEL` — Claude model version (e.g. `claude-sonnet-4-6`)
- `DEEPSEEK_MODEL` — DeepSeek model version (e.g. `deepseek-chat`)

All provider `defaultModel` fields now read from env vars with sensible fallbacks.

---

## Phase 3 — API & State

### `feat: implement /api/chat streaming route` (f6399ad)

`app/api/chat/route.ts` — **Only server entry point that invokes providers**:
- Accepts `POST` with `{ messages, providerId?, temperature?, maxTokens?, systemPrompt? }`
- Looks up provider from registry, calls `provider.stream()`
- Returns SSE response with appropriate headers

### `feat: add Zustand stores — conversation and model` (925f7e1)

`lib/store/conversation.ts` — Conversation CRUD:
- `conversations` list, `activeId` tracking
- `createConversation`, `deleteConversation`, `setActive`, `addMessage`

`lib/store/model.ts` — Model settings:
- `activeModelId`, per-model `modelSettings` map
- `setActiveModel`, `updateModelSettings`

### `feat: implement useStream and useConversation hooks` (a600fdc)

`hooks/useStream.ts` — SSE consumption:
- Fetch → `ReadableStream` reader → SSE line parsing
- Incremental `setRawContent` via functional state updates
- `AbortController` integration, error handling

`hooks/useConversation.ts` — Store wrapper:
- `sendMessage()` creates user message, returns conversation ID
- `appendAssistantMessage()` persists assistant response after streaming

### System prompt injection (88dbec9, 48e888b)

`lib/defaults.ts` — `ARTIFACT_SYSTEM_PROMPT` constant with detailed instructions
for model artifact output. `app/api/chat/route.ts` always injects it:
- No user systemPrompt → uses artifact prompt alone
- User provides systemPrompt → artifact prompt prepended

---

## Phase 4 — UI Components

### Chat UI (c549aa7)

| Component | File | Role |
|-----------|------|------|
| `MessageList` | `components/chat/MessageList.tsx` | Iterates messages, auto-scroll to bottom, empty state |
| `MessageBubble` | `components/chat/MessageBubble.tsx` | User: text bubble; Assistant: `react-markdown` + `remark-gfm` |
| `InputBar` | `components/chat/InputBar.tsx` | Auto-resize textarea, Enter to send, Shift+Enter newline |
| `StreamingIndicator` | `components/chat/StreamingIndicator.tsx` | Three-dot bouncing animation |

`@tailwindcss/typography` added for `prose` styling on markdown.

### Sidebar (b7f8804)

| Component | File | Role |
|-----------|------|------|
| `ConversationList` | `components/sidebar/ConversationList.tsx` | New conversation button, history list, empty state |
| `ConversationItem` | `components/sidebar/ConversationItem.tsx` | Title, relative timestamp, delete (hover), active highlight |

### Model Controls (bd865b5)

| Component | File | Role |
|-----------|------|------|
| `ModelSwitcher` | `components/model/ModelSwitcher.tsx` | Dropdown model selector, checkmark on active |
| `ModelSettings` | `components/model/ModelSettings.tsx` | Temperature slider, max tokens, system prompt textarea |

---

## Phase 5 — Artifact System

### Parser (529a92e)

`lib/utils/parseArtifact.ts` — Regex-based parser splits raw text into `Segment[]`:
- Complete `<artifact>...</artifact>` blocks → artifact segments
- Everything outside → text segments
- Incomplete opening tags (no matching close) → text, enabling incremental
  streaming; re-parse on next chunk converts to artifact once closing tag arrives

### Sandbox & Toolbar (c4a0757, bc538ea)

`components/artifact/ArtifactSandbox.tsx` — Sandboxed `<iframe>`:
- `sandbox="allow-scripts"` (no `allow-same-origin`)
- Content injected via `srcdoc` only — never via `src` or `innerHTML`
- `react`: Babel Standalone + React UMD from CDN, `prepareReactCode()` strips
  `export default` for Babel compatibility, auto-renders with `ReactDOM.createRoot`
- `html`: injected directly
- `svg`: wrapped in minimal HTML shell
- Post-message bridge: sandbox → parent `{ type: 'resize', height }`,
  parent → sandbox `{ type: 'theme', value }`
- CDN allowlist: `unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`

`components/artifact/ArtifactToolbar.tsx` — Title, refresh button,
expand/collapse toggle. Interacts only via props — no store access.

### Integration (3c37ec9)

`MessageBubble` updated: assistant messages parsed via `parseArtifact()` into
segments. Text segments → `ReactMarkdown`, artifact segments → `ArtifactToolbar`
+ `ArtifactSandbox` with refresh support via key rotation.

---

## Phase 6 — Page Assembly

### `feat: assemble pages` (d1f02a0)

`components/chat/ChatView.tsx` — Client orchestrator:
- Wires sidebar + model controls + message list + input bar + streaming
- Handles `"new"` conversation creation with URL redirect
- Auto-appends assistant message when streaming completes
- Reads messages from store for API calls via `getState()` (avoids stale closures)
- Error banner with dismiss

`app/page.tsx` — Redirect `/` → `/c/new`

`app/c/[id]/page.tsx` — Server Component shell, renders `ChatView` with `id` param

---

## Phase 7 — Bug Fixes & Hardening

### `fix: await params in conversation page` (d49c9a5)

Next.js 15 breaking change: dynamic route `params` is now `Promise<{}>`.
Changed `ConversationPage` to async component with `await params`.

### `fix: layout — flexbox overflow chain` (dcc2cda, f50a5e8)

**Symptom**: During streaming, InputBar was pushed offscreen as message content
grew, instead of MessageList scrolling independently.

**Root cause**: Three-level flex container cascade — each level had default
`min-height: auto`, preventing `overflow-y-auto` from engaging.

**Fix**:
- `ChatView.tsx` main area div: `min-h-0` on flex child
- `MessageList.tsx` message container: `min-h-0` on flex child
- `InputBar.tsx` outer div: `shrink-0` to lock position

### `fix: hydration mismatch from browser extension` (dcc2cda)

`suppressHydrationWarning` on `<html>` tag in `layout.tsx`. Browser extensions
like Immersive Translate inject `data-*` attributes before React hydration.

### `fix: nested <button> in ConversationItem` (dcc2cda)

HTML spec violation: `<button>` inside `<button>` is invalid. Browser parser
auto-closes outer button, causing hydration mismatch. Changed outer element
to `<div role="button" tabIndex={0}>` with keyboard handlers.

### `fix: CORS in artifact sandbox` (dcc2cda)

Removed `crossorigin="anonymous"` from CDN `<script>` tags in `ArtifactSandbox`.
`srcdoc` iframes have `origin: null`; `crossorigin` triggers CORS preflight
which unpkg CDN rejects. Without `crossorigin`, scripts load normally.

---

## Architecture Decisions

1. **Provider registry split** — `index.ts` (server, imports SDKs) vs `registry.ts`
   (client-safe, pure data). Prevents SDK tree-shaking failures in browser bundles.

2. **Artifact types separation** — `types/artifact.ts` kept separate from
   `types/conversation.ts` to avoid circular imports between parser, sandbox,
   and message bubble components.

3. **SSE stream consolidation** — Claude SDK events are converted to OpenAI-compatible
   SSE format inside ClaudeProvider. This means `useStream` only needs one parser
   for both providers.

4. **Store design** — Zustand `create()` for simplicity. Components that need
   synchronous post-mutation reads call `getState()` directly to avoid stale
   closure issues in event handlers.

5. **Artifact sandbox security** — `sandbox="allow-scripts"` only, no `allow-same-origin`.
   Content injected via `srcdoc` only. CDN scripts limited to allowlist.

---

## Known Limitations

- No persistence: conversations and settings live in Zustand stores (in-memory),
  lost on page refresh
- No mobile sidebar toggle: sidebar is hidden below `md` breakpoint with no hamburger
- Artifact React sandbox: `export default` stripping is regex-based, may fail
  on complex export patterns
- No authentication or multi-user support

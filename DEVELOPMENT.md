# Development Log

## Project: TwT.ai — Multi-Model AI Chat Frontend

A chat interface inspired by claude.ai, supporting Claude, DeepSeek, and
ModelScope models with streaming responses, conversation history, per-model
settings, and an Artifact system that renders interactive HTML/React/SVG inline.

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

## Phase 8 — Parser Refactor & Button Fixes

### `refactor: streaming state machine parser + stable segment IDs` (a8f1ffa)

Replaced regex-based `parseArtifact` with `ArtifactParser` state machine:
- Three states: `text` → `tag_open` → `body`
- Only processes delta on each call, not full string
- Buffers incomplete opening tags until `>` found
- Holds body content until `</artifact>` closes — then emits complete artifact
- Monotonic prefix detection auto-creates new parser when switching messages
- `flush()` converts buffered partial content to text on stream end
- Added stable `id` field to `Segment` type (`text-0`, `artifact-react-0`, ...)

**Button fixes**:
- `SegmentRenderer` extracted from `MessageBubble` body to module-level component —
  prevents state destruction on every parent re-render
- `ArtifactToolbar`: `expanded` moved to external prop + `onToggleExpand` callback
- `ArtifactSandbox`: accepts `expanded` prop, height ≥800px when expanded
- `key={seg.id}` on `SegmentRenderer` preserves instances across streaming re-renders

---

## Phase 9 — Persistent Storage

### `feat: add persistent storage for conversations and model settings` (b9ecd00)

**Storage backends**:
- Conversations → IndexedDB via `idb-keyval` + custom Zustand `StateStorage` adapter
- Model settings → localStorage (Zustand default)
- SSR-safe: `noopStorage()` fallback when `typeof window === 'undefined'`

**Limits**:
- 50 conversations max — oldest evicted on creation
- 200 messages per conversation — earliest truncated on insert

`lib/store/storage.ts` — `StateStorage` adapters with lazy `idb-keyval` initialization.

### `fix: null parser on first call` (7420961)

`lastRaw` initialised as `""` — every string passes `startsWith("")`, so the
`!raw.startsWith(lastRaw)` guard never fired. Added explicit `!currentParser` check.

---

## Phase 10 — UX Improvements

### `feat: slow-response warning, stop button, and retry` (ffb4c20)

**Slow response timeout** (`useStream.ts`):
- 15-second timer started on `send()`
- Cleared on first valid SSE delta
- If timer fires → `isSlowResponse = true` → amber warning text appears
- `isSlowResponse` exposed in hook return value

**Stop button** (`InputBar.tsx`):
- During streaming: send button replaced by square stop icon
- Click calls `onStop()` → `abort()` — stops the stream, preserves partial output
- Textarea stays enabled during streaming for pre-typing

**Retry** (`ChatView.tsx`):
- `lastUserMessageRef` tracks the last sent message content
- After error or cancel (empty content): "Retry" button appears
- `handleRetry()` re-sends the cached message content

---

## Phase 11 — sendPrompt API

### `feat: add sendPrompt API for sandbox-to-chat communication` (968dba0)

`ArtifactSandbox` injects `window.sendPrompt(text)` into every sandbox type
(react/html/svg) before all other scripts. Calls `postMessage` with
`{ type: 'sendPrompt', text }`.

Prop chain: `ArtifactSandbox` → `SegmentRenderer` → `MessageBubble` →
`MessageList` → `ChatView.handleSendPrompt` → `handleSend(text)`.

`ARTIFACT_SYSTEM_PROMPT` updated with sendPrompt documentation and two use cases
(interactive navigation + form submission).

---

## Phase 12 — ModelScope Provider

### `feat: add ModelScope provider` (222621b)

`lib/providers/modelscope.ts` — `ModelScopeProvider`:
- OpenAI-compatible endpoint: `https://api-inference.modelscope.cn/v1`
- Auth via `DASHSCOPE_API_KEY`
- Default model: `qwen-plus` (configurable via `MODELSCOPE_MODEL` env var)
- Registered in `index.ts` and `registry.ts`

---

## Phase 13 — Intent Routing & Prompt Split

### Prompt split + intent routing (a5e6ffa, 6cc91dc, 8aeafdb)

Split artifact prompt into two: `SYSTEM_PROMPT_TEXT` (forbids artifact tags) and
`SYSTEM_PROMPT_ARTIFACT` (artifact-enabled). `classifyIntent()` in API route
scans user's last message for keywords to select the right prompt. Server-side
response logging via `ReadableStream.tee()` — appends to `modelresponse` file.

---

## Phase 14 — Parser Robustness

### DeepSeek malformed tag fallbacks (2d70082, 5a277ad, d56c217)

Three common DeepSeek output defects, all handled by parser:

| Defect | Example | Fix |
|--------|---------|-----|
| `type` value is Chinese | `type="折线图"` | Sniff body content to determine type |
| `title=` sign missing | `title"图表"` | Regex makes `=` optional |
| `>` missing | `` <artifact type="react" title="X"export... `` | Detect code keywords after title → auto-close |

### `flush(hard)` semantic split (99937fb, 50d8baf)

`flush(false)`: streaming mode — only drains textBuf, preserves tagBuf/bodyBuf
to prevent partial tags from leaking into ReactMarkdown. `flush(true)`: persisted
mode — dumps everything, converts truncated body to code block.

### Per-message parser instances (50a97cf, 10abf94)

Replaced module-level `currentParser`/`lastRaw` singleton with per-message
`useMemo(() => new ArtifactParser())`. Eliminated interference when rendering
multiple history messages simultaneously. Removed dead `parseArtifact()` and
`flushArtifact()` module-level wrappers.

---

## Phase 15 — Streaming Pipeline

### Stable iframe lifecycle (c7866f9)

Assistant message created in store before streaming (`content=""`). `rawContent`
synced directly into same message — iframe key (msgId) never changes, never
unmounted. Eliminated CDN reload on stream end.

### `useLayoutEffect` for store sync (bd4258b)

Changed rawContent→store sync from `useEffect` to `useLayoutEffect` — runs
synchronously before paint, both updates land in same frame.

### Ref capture in setState updater (c16045a)

**Critical**: `setRawContent(prev => prev + pendingRef.current)` — React calls
updater asynchronously, ref already cleared. Fix: capture value in local
variable before calling setState.

### InputBar z-index (456cb4d)

MessageList overflow container overlaps InputBar by a few px. Clicks went to
message area. Fixed with `relative z-10`.

### Rehydration race guard (d935430)

`_hasHydrated` flag prevents user from sending messages before IndexedDB
persist middleware finishes loading (which would overwrite new data).

---

## Phase 16 — UI Polish

### Warm terracotta palette (ec7b481, ef09da6)

Claude.ai colors: `#faf9f5` cream, `#cc785c` coral primary, `#f3eadc` warm
panels, `#ded2c0` hairlines.

### Sidebar (cc51b79, c6998b9, 19a1f2e, 934b3bd, 77655c7, b2296cc)

Overlay on narrow, inline on wide. Manual toggle locks preference.
SSR hydration mismatch fixed.

### Artifact toolbar (9765156, b35470b, 442de60)

Hover-reveal with opacity transition. Lucide-react icons. Copy + download buttons.

### Placeholder + code preview (4022298, a01c968)

Animated "Generating..." with coral dots and expandable code preview during body state.

### Scrollbars (5b48e42), RAF throttle (843adef), CDN vendor (51b4d72, 3ac4518, b760deb)

6px warm scrollbars. RAF throttle for 60-80% fewer renders. All sandbox deps vendored.

---

## Architecture Decisions

1. **Provider registry split** — `index.ts` (server, imports SDKs) vs `registry.ts`
   (client-safe, pure data). Prevents SDK tree-shaking failures in browser bundles.

2. **Artifact types separation** — `types/artifact.ts` kept separate from
   `types/conversation.ts` to avoid circular imports between parser, sandbox,
   and message bubble components.

3. **SSE stream consolidation** — Claude SDK events are converted to OpenAI-compatible
   SSE format inside ClaudeProvider. This means `useStream` only needs one parser
   for two providers.

4. **Store design** — Zustand `create()` with `persist` middleware. Components that
   need synchronous post-mutation reads call `getState()` directly to avoid stale
   closure issues in event handlers.

5. **Artifact sandbox security** — `sandbox="allow-scripts"` only, no `allow-same-origin`.
   Content injected via `srcdoc` only. CDN scripts limited to allowlist.

6. **Streaming parser as state machine** — Character-level state machine that processes
   only the delta on each chunk, buffers partial tags, and assigns stable IDs.
   Eliminates regex re-scanning of accumulated text.

7. **Dual storage for persistence** — Large conversation data in IndexedDB (structured,
   queryable), small model settings in localStorage (simple key-value). Both use
   Zustand `persist` middleware with `partialize` to exclude functions.

8. **Stable message lifecycle** — Assistant message created in store before streaming.
   rawContent synced into the same message via `useLayoutEffect`. Same React key
   from creation through persistence — no iframe destroy/recreate, no CDN reload.

9. **Intent-based prompt routing** — User messages classify as text or artifact via
   keyword matching. Text path gets a shorter prompt, reducing token cost.

10. **Lenient parser as defense-in-depth** — Prompt instructs models to write correct
    tags, but parser handles common failure modes (malformed attributes, missing `>`).

---

## Model-Specific Issues

| Model | Artifact tag quality | Code generation quality | Recommendation |
|-------|---------------------|------------------------|----------------|
| Claude 4.x | Excellent — follows format correctly | Excellent — valid JSX | Best for artifacts |
| DeepSeek v4-pro | Poor — often omits `>`, `=`, or writes Chinese in `type` | Inconsistent — ~40% of responses have broken JSX | Use with parser fallbacks |
| ModelScope Qwen | Good — usually correct format | Good — generally valid JSX | Reliable alternative |

---

## Known Limitations

- DeepSeek artifact code generation quality is inconsistent — JSX syntax often
  broken (missing `function` keyword, malformed object literals)
- No mobile sidebar toggle: sidebar is hidden below `md` breakpoint with no hamburger
- Artifact React sandbox: `export default` stripping is regex-based, may fail
  on complex export patterns
- No authentication or multi-user support
- Streaming → persisted iframe may still re-create when `</artifact>` arrives on
  the same frame as `isStreaming → false` (rare edge case, React batching)

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
| `StreamingIndicator` | `components/chat/StreamingIndicator.tsx` | Animated robot face SVG (lavender/mint gradients, blink + float) |

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

### Parser defensive layers — handling output format variance (2d70082, 5a277ad, d56c217)

Three common format edge-cases, all handled by parser (not model defects):

| Edge case | Example | Fix |
|-----------|---------|-----|
| `type` value is non-standard | `type="折线图"` | Sniff body content to determine type |
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

Content-based progress detection (`detectPhase`) with expandable code preview during body state.

### Scrollbars (5b48e42), RAF throttle (843adef), CDN vendor (51b4d72, 3ac4518, b760deb)

6px warm scrollbars. RAF throttle for 60-80% fewer renders. All sandbox deps vendored.

### Auto-scroll respects user scroll position (021a4ae)

During streaming, auto-scroll only engages if user is within 80px of bottom.
Scrolling up to read history suppresses auto-scroll until user returns to bottom.

---

## Phase 17 — Dual Theme System

### `feat: add dual-theme CSS architecture with data-theme attribute` (b4211b1)

Replaced `@media (prefers-color-scheme: dark)` with `:root[data-theme="dark"]`
and `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`.
This overrides Tailwind v4's built-in dark variant so all 11 existing components'
`dark:*` utility classes respond to the `data-theme` attribute instead of the
system media query — zero component changes needed.

Added multi-color artifact tokens (comp-purple/green/orange/blue),
theme-aware scrollbar colour variables, and `--color-code-block`.

### `feat: add inline anti-flash script for theme initialization` (2d3cec1)

Synchronous `<script>` in `app/layout.tsx` `<head>` reads `localStorage('twt-theme')`
and sets `data-theme` on `<html>` before first paint — prevents FART (Flash of
Auto-detected Right Theme). Defaults to `"dark"`.

### `feat: add ThemeToggle component` (6f7ac99, ca873d4)

Custom SVG mask morph icon in `components/theme/ThemeToggle.tsx`:
- 8 sun rays + circle body + crescent mask
- `transitionend`-driven three-stage serial animation
  - sun→moon: rays fade ccw → body swells → mask bites crescent (~1300ms)
  - moon→sun: mask retracts → body shrinks → rays expand cw (~1250ms)
- `prevDark` ref + `mounted` dep guard prevents StrictMode double-fire corruption
  and ensures re-initialisation on the first mounted render
- Placed in ChatView top bar next to ModelSettings

### `refactor: apply refined colour palette` (4fd223e, 8c90753, 0407d9a)

Warm oatmeal/bone-china light palette (`#FBFBFA`, `#F7F5F0`, `#EBE8E0`)
and cocoa-black dark palette (`#141312`, `#0A0A09`, `#262422`).
User bubble becomes a light warm-grey capsule in light mode (`#F0EDE4`).
Code blocks use theme-aware `bg-code-block` instead of hardcoded zinc colours.
Asymmetric CSS transition: dusk 1200ms `cubic-bezier(0.4,0,0.6,1)`,
dawn 1800ms `cubic-bezier(0.2,0,0.4,1)` — computed from CSS variable read
at toggle moment, so light→dark reads 1200ms, dark→light reads 1800ms.

### Theme toggle icon iterations (6bf1d78, 04ecb60, b8b9867, a05ee53)

Icon evolved through: Lucide crossfade → custom SVG morph → Lucide dual-colour.
Final form: custom SVG mask morph with `text-body` for both states.
The morph uses CSS transition on `opacity` + `transform` on rays group,
`r` attribute on body circle, and `r` attribute on mask circle.

### View Transitions experiments (1c4e1ca, faabc08, 06ecb60)

Three approaches tried and removed:
1. **Ripple-out** (`clip-path: circle()`) — Chrome-only, boundary visible
2. **Radial-gradient overlays** (dusk encircle / dawn bloom) — complex DOM lifecycle
3. **Global CSS transition only** (current) — all colours self-transition,
   no DOM manipulation, zero edge artifacts. The simplest, most natural approach.

---
## Phase 18 — Artifact System Refinements

### `refactor: replace keyword intent routing with unified artifact prompt` (894e72e)

Deleted `classifyIntent()` — 18-keyword heuristic with high false-positive rate
("分析销售数据" missed, "画个简单流程图" over-triggered). `app/api/chat/route.ts`
now always uses `SYSTEM_PROMPT_ARTIFACT`, whose decision framework lets the model
judge text vs artifact based on context. `SYSTEM_PROMPT_TEXT` kept for future use.

### `feat: expand artifact type roles` (5698733)

All three artifact types now support interactivity + `window.sendPrompt()`:
- `type="svg"`: native interactivity (links, hover, onclick, `<foreignObject>`)
- `type="html"`: full JS+DOM, primary choice for forms/demos/simple tools
- `type="react"`: complex state/charts (Recharts + ResponsiveContainer)

Added system prompt sections: form→sendPrompt collection pattern,
CHART STYLING rules (# prefix, 3:1 contrast, visible grid lines).

### Sandbox error logging improvement (current)

`window.addEventListener('error', ...)` + `console.error` proxy in sandbox
sends full error details (message, stack, line number) via
`postMessage({ type: 'sandbox-error', error })`. Parent component logs to console.

### Recharts auto-injection (current)

`prepareReactCode()` auto-injects destructuring of 21 Recharts components
(`LineChart`, `ResponsiveContainer`, `AreaChart`, etc.) before user code.
Prevents `ResponsiveContainer is not defined` errors from model-generated code
that omits manual destructuring.

### UI colour fixes for light mode (045af83, current)

- ThemeToggle icon: `text-muted-soft` → `text-body` with hairline border
- Code blocks: `[&_pre]:text-ink dark:[&_pre]:text-on-dark-soft` fixes
  prose-zinc light text on light background
- StreamingIndicator dots: `bg-muted` → `bg-body`
- Placeholder text: `text-muted` → `text-body`, preview button `text-muted-soft` → `text-muted`
- Placeholder preview area: `bg-surface-dark` → `bg-code-block` (theme-aware)
- InputBar/ModelSettings inputs: added `transition-[border-color] duration-200`
  to prevent 1200ms focus-border lag from global CSS transition

### `fix: add mounted to effect dep array` (current)

ThemeToggle's SVG init `useEffect` depended on `[isDark]` alone. When `isDark`
didn't change between the unmounted (placeholder) and mounted (SVG-present)
renders — which happens on dark-mode page refresh — the effect never fired and
`applyFrame()` was never called, leaving the icon at its default JSX state
(a small outlined circle). Added `mounted` to deps: `[isDark, mounted]`.

---
## Phase 19 — AskCard + Message Actions

### `feat: add AskCard component — structured question tabs` (712a2a9)

`components/chat/AskCard.tsx` — Fixed position card above InputBar:
- Parses `<ask_user>` JSON blocks from model response
- Dynamic question count rendering with option stagger animation
- Keyboard navigation (↑↓ Enter), hover highlights
- Custom text input row with Pencil icon + Skip button
- Accumulates answers across questions, sends all on last question

`lib/utils/parseAskCard.ts` — `parseAskCard(content)` extracts and validates
JSON from `<ask_user>` blocks. Returns `AskCardData | null`.

### AskCard integration + animations (60ae486, b9218c9)

`ChatView.tsx`:
- `showAskLoading` — three-dot indicator during streaming when `<ask_user>`
  detected but not yet closed
- `askCardData` derivation after streaming completes — parses model output
- Context prefix on tab submit: `关于"...", 我的选择如下：`

`MessageBubble.tsx` — strips `<ask_user>` blocks from rendered content:
- Completed blocks: `<ask_user>...</ask_user>` (greedy)
- In-progress blocks (streaming): `<ask_user>...` to end of string

System prompt updated: `<ask_user>` now preferred over HTML artifact forms
for structured information collection.

### `feat: inline edit + copy/retry on user messages` (f679941)

User messages gain three icon buttons visible on `group` hover:
- **Copy** — copies message text to clipboard, check icon feedback
- **Edit** — switches bubble to inline textarea, Enter to submit, Escape to cancel
- **Retry** — removes last assistant message + re-sends with same user content

`handleEditSubmit` updates user message content in store, removes old assistant,
then re-sends. `handleRetry` uses `activeId` (not ref) to fix cold-start retry.
`doSend` helper extracted to avoid duplicate user messages on retry/edit.

`lib/store/conversation.ts` — added `removeLastAssistantMessage(conversationId)`.

---
## Phase 20 — Debug Mode

### `chore: add logger utility with NEXT_PUBLIC_DEBUG gate` (7b694dc)

`lib/utils/logger.ts` — Four-level unified logger:
- `error` — always outputs
- `warn/info/debug` — gated behind `NEXT_PUBLIC_DEBUG=true`
- Zero dependencies, no project-internal imports — safe for any module

### `feat: add DebugPanel component` (a139ffe)

`components/debug/DebugPanel.tsx` — Collapsible real-time debug overlay:
- Shows rawContent last 500 chars + isStreaming/isSlowResponse flags
- Reads last message role/content length from Zustand store
- Copy rawContent to clipboard button
- Collapsed to single `[Debug] Open` tab when not needed
- Only mounts when `NEXT_PUBLIC_DEBUG=true` — tree-shaken in production

### `feat: integrate logger into streaming pipeline` (8a5f864)

Strategic log points added:
- `useStream.ts`: send start, first chunk, each delta (first 50 chars),
  abort, stream error, finally cleanup
- `parseArtifact.ts`: state transitions (tag_open → body → text), flush(hard)
- `ArtifactSandbox.tsx`: `console.error` → `logger.error`; sandbox postMessage
  events logged via `logger.debug`
- `ChatView.tsx`: `<DebugPanel>` conditionally rendered above InputBar

No event bus — sandbox events and SSE raw chunks use `logger.debug` to console
to avoid module-level singleton mixing events across multiple iframes.

### `feat: terminal-level route logging` (17162fb)

`app/api/chat/route.ts` — replaced modelresponse file I/O with terminal logging:
- `logger.info` at request start (model, msgCount, maxTokens)
- `logger.info` at stream end (model)
- File logging code preserved as comments for easy re-enable

---
## Phase 21 — System Prompt Refinements

### `feat: require clickable SVG diagram nodes` (1b7e892)

Split SVG type into two sub-categories in system prompt:
- **NAVIGATIONAL** (architecture, flowcharts, org charts) — MUST have
  `onclick+sendPrompt()` on every meaningful node with hover feedback
- **DECORATIVE** (illustrations, timelines) — no click requirement

### `refactor: compress system prompts by ~50%` (a27ba4a)

`SYSTEM_PROMPT_TEXT`: 20→10 lines, merged role+markdown into one block.
`SYSTEM_PROMPT_ARTIFACT`: 192→100 lines, ~2500→~1200 tokens:
- Removed decorative `───` dividers (saved 12 lines)
- Compressed `<ask_user>` JSON example from 6 lines to 1
- Merged Markdown/Chart/Visual sections into one
- Merged React Sandbox notes into decision tree
- Kept Recharts explicit enumeration (no `...` shorthand — literal-model-safe)

### Unified artifact prompt refinements (ed6da37)

Restructured type decision tree:
- Step 1: svg for static/visual (was: svg for non-interactive)
- Step 2: react for component model → html as DEFAULT fallback
- Added CDN library support for HTML artifacts (Chart.js, D3, Three.js)
- Expanded CHART STYLING to cover all sandbox types

---
## Phase 22 — Provider & Bug Fixes

### `fix: pass CLAUDE_BASE_URL to Anthropic client` (f9ce191)

`lib/providers/claude.ts` — `baseUrl` field was declared but not passed to
`new Anthropic()`. Now reads from `CLAUDE_BASE_URL` env var with fallback to
`api.anthropic.com`. Enables proxy/relay API endpoints.

### `fix: replace tee() with pass-through stream` (7e5cedd)

`app/api/chat/route.ts` — `ReadableStream.tee()` buffers both branches in
memory, causing OOM on large ModelScope responses. Replaced with single
pass-through stream that accumulates chunks for logging without double-buffering.
Also truncates modelresponse log to last 50 entries.

### `fix: strip streaming ask_user and hide copy during streaming` (6771011)

- Added second regex `.replace(/<ask_user>[\s\S]*$/, "")` for in-progress
  streaming ask_user blocks without closing tag
- Copy button hidden on assistant bubble while stream is active (`!streaming` guard)

### `fix: Zustand infinite loop in DebugPanel` (current)

DebugPanel selector returned a new `{ role, contentLen }` object every call —
Zustand's `Object.is` comparison always detected a change → infinite loop.
Fixed by returning `Message | null` (stable reference) from selector.

---
## Phase 23 — Provider Architecture Refactoring

### Config-driven provider factory (4ca9149, 65b8752)

Provider configuration centralised into `lib/providers/config.ts`:
- `ProviderConfig` interface: `{ id, name, type, apiKey, baseUrl, model }`
- Built-in providers defined as data, not hardcoded in class files
- `getProviderMetas()` — client-safe (id + name only)
- `getProviderConfigs()` — server-only (full config with API keys)
- `getAvailableProviders()` — server-side filtering by non-empty API key

Created `lib/providers/generic.ts` — `OpenAICompatibleProvider`:
- Constructor receives `ProviderConfig`
- Replaces per-provider boilerplate classes

Deleted `lib/providers/deepseek.ts` and `lib/providers/modelscope.ts` —
both were empty subclasses with only field assignments, now handled by
`OpenAICompatibleProvider`.

`ClaudeProvider` refactored to receive `ProviderConfig` instead of reading
env vars directly (`apiKey`, `baseUrl`, `defaultModel` all from config).

`index.ts` factory now driven by `config.type`:
- `"anthropic"` → `ClaudeProvider`
- `"openai-compatible"` → `OpenAICompatibleProvider`

Custom providers via `CUSTOM_PROVIDERS` env var (JSON array) — restart
`pnpm dev` and the new provider appears in the frontend. No code changes.

### Server Component props for model selection (2a7b833, 751ce76)

`app/c/[id]/page.tsx` (Server Component) calls `getAvailableProviders()` and
passes the list as props through `ChatView` → `ModelSwitcher`. This means
the frontend only shows providers with actual API keys configured — no more
showing "Claude" when `ANTHROPIC_API_KEY` is empty.

`NEXT_PUBLIC_CUSTOM_PROVIDERS` removed — provider names no longer exposed
in client bundle. `getProviderMetas()` marked deprecated.

### `fix: remove provider cache` (146411b)

`providerCache` Map kept the first Provider instance forever, so env changes
at dev-server restart were silently ignored. Provider constructors are
stateless — caching buys nothing. Removed.

### Model name display in switcher (3491cc0)

`ModelSwitcher` now shows actual configured model name alongside provider name:
"DeepSeek · deepseek-v4-flash" instead of just "DeepSeek".

### `fix: share DEFAULT_* via NEXT_PUBLIC_ prefix` (a7050d1)

Renamed `DEFAULT_TEMPERATURE` → `NEXT_PUBLIC_DEFAULT_TEMPERATURE` and
`DEFAULT_MAX_TOKENS` → `NEXT_PUBLIC_DEFAULT_MAX_TOKENS`. Both `route.ts`
(server) and `ModelSettings` (client) read the same env vars — no more
4096 vs 8192 mismatch between API calls and the Settings panel.

---
## Phase 24 — Server Diagnostics

### Box-framed request logs (f9b5927, 0dc5ad0)

Replaced flat `logger.info` calls in `route.ts` with `console.log`
box-drawing format:
```
┌─ chat  wuhp61gt ─────────────────────
│  model   deepseek
│  msgs    3
│  tokens  8192
│  done    2898ms
└────────────────────────────────────
```

`conversationId` now passed through `useStream.send()` → POST body →
route.ts extracts last 8 chars as request ID. Each log frame maps directly
to a browser URL.

### Sandbox error capture (8fb2a0b)

Replaced Babel's auto-processing of `<script type="text/babel">` with
manual `Babel.transform()` + `eval()` wrapped in try/catch. Browser no
longer sanitises error details (cross-origin "Script error." → full
stack trace with line numbers).

### `feat: re-enable modelresponse file logging` (e0c81af)

Uncommented raw SSE recording to `modelresponse` file for debugging
proxy/relay text corruption issues.

---
## Phase 25 — UI Polish

### `fix: dark mode text invisible in edit textarea` (3eb6982)

Inline-edit textarea in user bubble used `text-ink` without dark mode
counterpart — text was #3D3D3A on dark background. Added
`dark:bg-surface-dark-elevated dark:text-on-dark`.

### `fix: ModelSwitcher dropdown auto-width` (53288fa)

Changed `w-48` (fixed 192px) to `min-w-44` (minimum 176px, auto-expands)
with `whitespace-nowrap` — prevents model names like "deepseek-v4-flash"
from overflowing the dropdown.

### Scrollbar, focus border, and colour fixes (045af83, various)

- StreamingIndicator: robot face SVG with lavender/mint gradient animations + glow filters
- InputBar/ModelSettings: `transition-[border-color] duration-200` to
  prevent 1200ms global CSS transition lag on focus
- Code blocks: `prose-zinc` dark text on light background fixed with
  `[&_pre]:text-ink dark:[&_pre]:text-on-dark-soft`
- Placeholder preview area: `bg-surface-dark` → `bg-code-block` (theme-aware)

---
## Phase 26 — Dual Storage Mode

### `feat: add PostgreSQL database adapter` (adbbe94)

`lib/db/index.ts` — Neon serverless PostgreSQL adapter:
- `getState(key)` / `setState(key, value)` / `deleteState(key)`
- Single state table: `key` (PK), `value` (JSONB), `updated_at` (TIMESTAMPTZ)
- Uses `@neondatabase/serverless` — serverless-native WebSocket driver

### `feat: add server storage adapter + /api/conversations endpoint` (51b1b75)

`lib/store/server-storage.ts` — Zustand `StateStorage` implementation via `fetch()`:
- `getItem` → `GET /api/conversations?key=...`
- `setItem` → `POST /api/conversations`
- `removeItem` → `DELETE /api/conversations?key=...`
- All requests carry `Authorization: Bearer ${ACCESS_SECRET}`

`app/api/conversations/route.ts` — CRUD endpoint:
- `ACCESS_SECRET` auth guard on every handler
- Delegates to `lib/db` for PostgreSQL read/write/delete

### `feat: dual storage mode switching` (6959d48)

`lib/store/conversation.ts` — detects `NEXT_PUBLIC_STORAGE_MODE`:
- `"server"` → `createServerStorage()` (PostgreSQL, multi-device)
- default (unset) → `createConversationStorage()` (IndexedDB, local-only)

`.env.example` updated with `STORAGE_MODE`, `ACCESS_SECRET`, `DATABASE_URL`.
README updated with server-side persistence setup guide (Neon + SQL).

**Design decisions:**
- Auth via shared secret (`NEXT_PUBLIC_ACCESS_SECRET` in client bundle — acceptable
  for single-user deployment; cookie-based flow planned for future)
- No `initDB()` / `initialized` singleton — Serverless cold starts would reset it.
  Table creation is a manual SQL step in Neon console
- Zustand `StateStorage` interface kept unchanged — same shape as IndexedDB adapter,
  just the transport layer differs

---
## Phase 27 — Bug Fixes & Polish

### `fix: add maxDuration=60 to API routes` (66f9f8a)

Vercel Hobby plan has a 10s default function timeout. Streaming responses easily
exceed this. Added `export const maxDuration = 60` to both `/api/chat` and
`/api/conversations`.

### `fix: lazy-init neon() to prevent build crash` (523f306)

`neon(process.env.DATABASE_URL!)` was called at module top-level, which executes
during `next build` — before `DATABASE_URL` is available. Moved to a lazy getter
that only connects on the first API request.

### `fix: escape tilde before Markdown rendering` (ba6befe)

GFM treats `~` as a strikethrough delimiter, eating the character itself from
text like "20~50" or "~3 hours". Added `seg.content.replace(/~/g, "\\~")` before
`ReactMarkdown` so tildes render as literal text.

### `feat: forbid hardcoded gray text colors in prompt` (f77b3b4)

Artifact models frequently used `#666`, `#888`, `#999` as text colors — invisible
on dark backgrounds. Added constraint to VISUAL DESIGN: no hardcoded gray text
colors below `#D0` brightness.

### Documentation (d0dca47, 39173af, 8f72f2b, fc9e38c)

- Added demo GIF screenshot to README (EN + CN)
- Added Deployment section (Vercel + Neon + production lockdown)
- De-duplicated server-side persistence sections across Configuration and Deployment
- Removed `DEVELOPMENT.md` from `.gitignore`

---
## Phase 28 — Hardening & Access Control

### `feat: add password gate for private deployment` (6b0ea69)

`components/auth/AuthGate.tsx` — Client component that gates the entire app
behind a password form. On mount, calls `GET /api/auth` to check for an existing
cookie. If 401, renders a centered login card (theme-aware, auto-adapts to
light/dark). On submit, `POST /api/auth` validates the password and sets a 24h
HttpOnly cookie.

`app/api/auth/route.ts`:
- `GET` — checks `twt-auth` cookie; always returns `ok` when `ACCESS_PASSWORD`
  is unset (public mode)
- `POST` — compares `body.password` to `ACCESS_PASSWORD`, sets cookie on match

`app/layout.tsx` — Server Component checks `process.env.ACCESS_PASSWORD`:
- Set → wraps children in `<AuthGate>`
- Unset → renders children directly (zero overhead)

`.env.example` — added `ACCESS_PASSWORD`.

### `feat: constrain Markdown preamble to 3-5 sentences` (dc038c0)

System prompt updated: "Write a 3-5 sentence Markdown summary BEFORE the
artifact — frame what you built and why. The artifact is the primary
deliverable." Prevents model from burning 80% of output tokens on description.

### `chore: raise DEFAULT_MAX_TOKENS from 8192 → 131072 (128K)` (5c0d54e)

Matches Claude Sonnet 4.6 / Opus 4.8 max output limit. DeepSeek V4 supports
up to 384K but 128K is a safe universal default. Updated `.env.example`,
`ModelSettings.tsx`, `route.ts`, and `CLAUDE.md`.

### `fix: resolve all 3 ESLint warnings` (80348ea)

- Removed unused `_expanded` prop from `ArtifactSandbox` (and `expanded`
  from the interface + all call sites)
- Removed unused `TRANSITION` constant from `AskCard`
- Inlined `cleanContent` regex into `useMemo` to fix `exhaustive-deps`

### `chore: switch default theme from dark to light` (01e9640)

Anti-flash script in `app/layout.tsx` now defaults to `'light'` on first visit.
All existing `dark:*` classes, `ThemeToggle`, and persisted preferences are
unaffected.

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

9. **Intent-based prompt routing** (REMOVED) — Formerly used keyword matching
   to route between text and artifact prompts. Replaced by unified prompt with
   model-side decision framework. Keyword routing had higher misclassification cost
   than the extra token cost of always using the artifact prompt.

10. **Global CSS transition as theme engine** — Replaced View Transitions API
    and overlay-based approaches. All elements transition `background-color`,
    `color`, `border-color` with asymmetric durations (1200ms dusk / 1800ms dawn)
    and non-linear easings. Zero DOM manipulation, full browser compatibility.

10. **Lenient parser as defense-in-depth** — Prompt instructs models to write correct
    tags, but parser handles common failure modes (malformed attributes, missing `>`).

---

## Phase 29 — Branding, Hardening & UX Polish

**Commits:** 80cf3c0 → 6424c52 (7 commits)

### StreamingIndicator redesign
Replaced the three bouncing dots with an animated robot face SVG:
- Lavender-to-mint gradient shimmer on eyes/mouth via `<animate stop-color>`
- CSS keyframe animations: `si-blink` (eyes scaleY), `si-brow-lift` (brows translateY),
  `si-face-float` (whole face translateY + scale)
- Radial gradient background (#253555 → #1a2540) with top highlight streak
- SVG `<feGaussianBlur>` + `<feColorMatrix>` glow filters
- All CSS class/keyframe names prefixed `si-` to prevent conflicts with sidebar icon.
- `isSlow` warning text preserved — appears below the SVG after 15 s.

### Sidebar brand icon
`ChatView.tsx` sidebar header: animated robot face (28 px, `sb-` prefixed class/keyframe
names to isolate from StreamingIndicator) placed left of "TwT.ai" text.

`app/icon.svg`: updated to branded robot face (static; used as favicon).

### Model settings: env-first, session-only
`lib/store/model.ts` persist `partialize` changed to only save `activeModelId`.
`merge` ignores old `modelSettings` from localStorage on upgrade.
temperature / maxTokens / systemPrompt now always read from `.env` on session start;
Settings panel changes persist only in-memory until the next reload.

### Artifact placeholder: content-based progress
`PlaceholderBar` (`MessageBubble.tsx`) replaced `setInterval` fake cycling with
`detectPhase(code, artifactType)` — a pure function that inspects the actual
streamed code to infer the current phase (e.g. "正在编写样式…" when `<style>` is
open, "正在编写脚本…" when `<script>` is open). `types/artifact.ts` placeholder
segment gained `artifactType?` field; `parseArtifact.ts` sniffs type from body
content when emitting placeholders.

### Storage hardening
`lib/store/server-storage.ts`:
- SSR guard (`typeof window === "undefined"` → noop storage) aligns with
  `storage.ts` — eliminates startup `ERR_INVALID_URL` unhandled rejection.
- `waitForPersistence()` export tracks latest `setItem` promise.

`components/chat/ChatView.tsx`:
- `handleSend`: `await waitForPersistence()` before `router.replace()` on new
  conversations (closes Neon cold-start race window).
- `handleSend`: `if (isStreaming) return` guard prevents duplicate sends from
  rapid sandbox `sendPrompt` clicks.

### Color refinements
- Stop button: solid dark block → hairline-border outline style
- AskCard selected number badge: `bg-ink`/`bg-on-dark` → unified `bg-primary text-white`
- ArtifactToolbar title + icons: contrast raised one step
- Artifact placeholder: dark mode background + border override
- StreamingIndicator dots (current): dark mode `#B0A89E` for ~5:1 contrast

---

## Phase 30 — Async/Timing Audit & Rendering Smoothness

**Commits:** a1587b7 → c74c5b6 (3 commits)

Three parallel agents audited the entire codebase for async timing issues,
covering the streaming pipeline, store persistence layer, and UI rendering
(19 files). 37 issues found and fixed across HIGH / MEDIUM / LOW tiers.

### HIGH tier (5 issues)
- **useStream retry corruption**: old `.finally()` would clear new stream's
  `isStreaming`, `slowTimer`, and `abortRef` after retry. Fixed with `sendIdRef`
  counter — finally block bails out if the ID doesn't match.
- **useStream data loss at stream end**: TextDecoder internal buffer and SSE
  line accumulator (`buffer` variable) were never drained after the while loop.
  Fixed by calling `decoder.decode()` (flush) and processing remaining lines.
- **conversation hydration guard**: `createConversation` now checks
  `_hasHydrated` before executing, preventing store mutations during rehydration
  from being overwritten by persisted data.
- **ThemeToggle transitionend leak**: rapid double-toggle left stale
  `transitionend` callbacks that corrupted the SVG morph state. Fixed with
  `animIdRef` counter — each animation stage checks the ID before executing.
- **globals.css `*` transition rule**: `*, *::before, *::after` applied
  `transition-property` to every DOM node, causing measurable style-recalc
  overhead during streaming. Replaced with attribute selectors targeting
  only elements with Tailwind colour classes (`[class*="bg-"]`, etc.).

### MEDIUM tier (10 issues)
- `handleRetry` now clears error toast before retry (`setToast(null)`)
- `route.ts` passthrough `ReadableStream` gained `cancel()` handler to
  propagate client disconnects upstream (saves wasted API tokens)
- `route.ts` `pull()` wrapped in try/catch for error visibility
- `ArtifactSandbox.srcdoc` memoized via `useMemo([artifactType, content])`
- Artifact resize `postMessage` debounced via `requestAnimationFrame`
- `MessageBubble` parser stored in `useRef` — delta tracking (`this.processed`)
  now actually works, avoiding O(n) re-scan on every token during streaming
- `MessageList` empty state now requires `_hasHydrated` to prevent flash
- `server-storage` `setItem` stores its promise locally before assigning to
  `latestSetItem`, preventing concurrent-caller await confusion
- `server-storage` `setItem` wraps `JSON.parse` in try/catch
- `ChatView.handleSend` streaming guard

### LOW tier (6 issues)
- `useStream.pendingRef` changed from `string` (+= concat, O(n^2)) to `string[]`
  (push + join)
- `route.ts` debug `logContent` changed from string concat to array join
- `storage.ts` `idb-keyval` imported once into a shared variable instead of
  per-method dynamic imports; `ensureDb` resets `pending` on failure for retry
- Dead `modelStorage` export removed from `storage.ts`

---

## Phase 31 — GPU Compositor Layer Fix

### `fix: promote InputBar to GPU compositor layer to prevent iframe click interception` (824856f)

When `MessageBubble`'s `animate-fade-in` retains `transform: translateY(0)` via
`animation-fill-mode: forwards`, the iframe inside is promoted to a GPU compositor
surface.  The browser's hit-testing tree walks GPU layers before CPU-rendered
elements, so clicks on the InputBar (z-10, CPU) were intercepted by the iframe
GPU layer below it.

**Fix**: `[transform:translateZ(0)]` on InputBar's wrapper — a visual no-op that
forces the element into its own GPU layer, restoring correct hit-test ordering.

---

## Phase 32 — Sidebar Menu Overhaul

### `feat: Portal-based dropdown menu with rename, delete, and confirmation UI` (45f0eb2)

Replaced the hidden `group-hover` delete button with an always-accessible `⋮`
ellipsis menu.  Key design decisions:

- **Portal to `document.body`**: the dropdown lives inside an `overflow-y-auto`
  scroll container; Portal escapes CSS overflow clipping.
- **Viewport-relative positioning**: `getBoundingClientRect()` on the `⋮` button
  computes `position: fixed` coordinates.  Direction flips upward when
  `btn.bottom + menuH > window.innerHeight`.
- **Rename modal**: centered overlay (`fixed` + `backdrop-blur`) with pre-filled
  input, OK triggers confirmation step.
- **Confirmation UI**: matching the edit-retry button style (`rounded-xl`,
  `bg-[#E8E4DC]`/`bg-[#2D2B27]` for Cancel, `bg-primary` for Confirm,
  `bg-red-500` for Delete).
- **Active highlight**: `bg-[#F0ECE2]` / `bg-[#2A2722]` — warmer than the
  subtle `bg-canvas-card` for better visual distinction.
- **Hover-reveal**: timestamp and `⋮` button use `opacity-0 group-hover:opacity-100`
  on all conversations.

`ConversationList` passes `onRename={updateTitle}`; `useConversation` exposes
`updateTitle` from the store.

---

## Phase 33 — Auto-Title Generation

### `feat: auto-generate conversation titles after first exchange` (bde66c8)

`lib/utils/generateTitle.ts` — calls `/api/chat` with a lightweight summarisation
prompt after the first user+assistant exchange completes.  Collects SSE chunks,
cleans quotes and punctuation, caps at 80 chars.  Falls back to
`firstUserMsg.slice(0, 30)` if the API call fails.

Triggered in ChatView via `prevStreamingRef` detecting `isStreaming` going from
true to false, checking for exactly 2 messages and `title === "New conversation"`.

---

## Phase 34 — Sandbox Responsive + Prompt Density

### `feat: make artifact sandbox responsive, add content density rules to prompt` (b18e49e)

**ArtifactSandbox**: added `<meta name="viewport" content="width=device-width,initial-scale=1">`
and `*{max-width:100%;box-sizing:border-box}` to HTML/React/SVG sandboxes to
prevent horizontal overflow on mobile.  Removed `#root { min-height: 100vh }`
from React sandbox — the ResizeObserver already reports content height; min-height
added unnecessary blank space.  SVG retains `body { min-height: 100vh }` for
vertical centering.

**SYSTEM_PROMPT_ARTIFACT**: added three new sections:
- **Content Density & Complexity Limits** — ≤4 boxes/row, ≤5-word subtitles,
  ≤2 colour families, no comments, explanatory text outside artifact
- **Streaming-First Structure Order** — `<style>` → content HTML → `<script>` last
- **Prohibited CSS** — `position: fixed` (collapses iframe), gradients (DOM diff
  flicker), hardcoded gray text (#666 etc.)

---

## Phase 35 — Multi-Tab Storage Safety

### `fix: block persist writes until hydration to prevent multi-tab data loss` (cbf9ea6)

Module-level `storageBlocked` flag set to `true` on module load, cleared in
`onRehydrateStorage`.  The JSON storage wrapper checks it before `setItem`/`removeItem`,
blocking the initial empty-state write that would overwrite existing data in
other tabs.  Applies to both IndexedDB and PostgreSQL storage modes.

### Additional storage hardening (471be1d)

- **Server-storage trailing timer**: replaced closure-captured snapshot with
  module-level `latestParsed` — the 1 Hz throttle now writes the most recent
  state, not the state from when the timer was scheduled.
- **IndexedDB cross-tab mutex**: `navigator.locks.request("twt-conversations", ...)`
  serialises writes across tabs.
- **Server-storage empty-state guard**: `setItem` skips writes when
  `conversations` is empty AND `activeId` is null — second safety net.

### `fix: modelId on conversation creation` (471be1d)

`ConversationList` and `useConversation.sendMessage` now create conversations
with `useModelStore.getState().activeModelId` (currently selected model) instead
of `getDefaultModel()` which always returns the `.env` default.

---

## Phase 36 — Streaming Scroll Fix

### `fix: streaming auto-scroll — decouple polling from messages, add ResizeObserver` (b0da5f7)

Split the `useEffect` in `MessageList`:
- Synchronous `scrollToBottom()` on every render (not tied to a dependency array)
- 120ms polling interval bound only to `[streaming]` — no longer killed and
  recreated on every ~16ms content update
- `ResizeObserver` on the inner message wrapper catches layout-computed height
  changes from Markdown/code-block rendering

---

## Phase 37 — Mobile Theme Transition

### `fix: mobile theme toggle lag — reduce transition duration, defer localStorage` (cbe87bd)

- **globals.css**: `@media (max-width: 639px)` reduces `--theme-transition-duration`
  from 1800ms to 600ms — cuts GPU compositor paint frames from ~108 to ~36
- **ThemeToggle**: `localStorage.setItem` deferred via `setTimeout(0)` to avoid
  blocking the current frame

### `fix: add setTimeout fallback for ThemeToggle transitionend chain` (f7049d6)

The SVG morph animation uses a three-stage `transitionend` chain.  On mobile,
`transitionend` may not fire if the compositor is busy.  Each stage now has a
`setTimeout` fallback at `stageDuration + 100ms`.  `applyFrame()` resets to the
target starting frame before each animation, preventing PC rapid-toggling from
starting from an intermediate state.

---

## Phase 38 — Mobile Interaction Fixes

### `fix: add mobile touch support to SelectionReply and message action buttons` (7429e6a)

**SelectionReply**: added `touchend` listener alongside `mouseup` for mobile
text selection.  `selectionchange` listener updates captured text while the user
drags selection handles.  `touchFlagRef` prevents synthetic `mousedown` (fired
~300ms after `touchend`) from immediately hiding the button.

**MessageBubble**: tap-to-reveal action buttons (`actionsVisible` state toggled
on bubble click).  Desktop hover unchanged.  Assistant avatar hidden on small
screens (`hidden sm:block`).

---

## Phase 39 — Streaming Rendering Performance

### `fix: streaming smoothness — RAF+fallback, useEffect sync, ReactMarkdown memo` (9043e74)

Three-layer optimization to eliminate streaming text stutter:

**useStream.ts**: replaced `setInterval` with `requestAnimationFrame` + 200ms
`setInterval` fallback.  RAF keeps foreground rendering smooth at display
refresh rate; the fallback prevents data stalling when the tab is backgrounded
(mobile app-switch, desktop tab-switch).  `isStreamingRef` controls the RAF
loop lifecycle.  `startTransition(() => setIsStreaming(false))` defers the
post-stream Markdown re-parse to low-priority.

**ChatView.tsx**: `useLayoutEffect` → `useEffect` for rawContent → store sync.
Asynchronous effect lets the browser paint before the store update, avoiding
blocked frames during heavy streaming.

**MessageBubble.tsx**: extracted `ReactMarkdown + remarkGfm` into `MemoMarkdown`
— a `React.memo` wrapper with `prev.content === next.content` comparison.
Stable text segments skip re-parsing entirely.  Only the actively growing
segment incurs Markdown cost each frame.

### `perf: throttle ReactMarkdown renders to 100ms during streaming` (bacaf41)

Module-level `lastMarkdownRender` timer gates the `MemoMarkdown` comparator:
if `streaming` is true and less than 100ms since the last render, skip even
when content changed.  Grows Markdown re-parse to ~10 fps while raw text
appends continue at full speed.  Combined with content-memo, the per-frame
ReactMarkdown overhead drops ~90%.

---
## Phase 31 — GPU Compositor Layer Fix

### `fix: promote InputBar to GPU compositor layer to prevent iframe click interception` (824856f)

**Symptom**: When an artifact iframe was rendered in the chat, clicking on the
InputBar textarea passed through to the iframe. The cursor appeared on the
artifact diagram instead of changing to a text I-beam, and clicks focused the
iframe instead of the textarea.  The InputBar worked fine in areas with no
iframe underneath — only the overlapping region was affected.

**Root cause**: `MessageBubble` uses `animate-fade-in` with `animation-fill-mode:
forwards`.  The final keyframe has `transform: translateY(0)`, which the
`forwards` fill preserves permanently.  Any `transform` value other than `none`
creates a GPU compositor layer — the iframe (child of the animated wrapper) was
thus rendered in a GPU surface.  The browser's hit-testing tree walks GPU
layers before CPU-rendered elements, so the iframe intercepted clicks even
though InputBar had `relative z-10`.

**Fix**: Added `[transform:translateZ(0)]` to InputBar's wrapper div
(`components/chat/InputBar.tsx`).  `translateZ(0)` is a visual no-op — it moves
nothing, scales nothing.  Its sole purpose is to force the InputBar into its
own GPU compositor layer so the layer-tree ordering respects CSS `z-index`.

**Dead ends explored** (5+ attempts across multiple files):
| Attempt | Why it failed |
|---------|---------------|
| Clamp iframe height via `getBoundingClientRect` | Made artifacts too short in the lower half of the viewport |
| `contain: paint` on MessageList scroll container | Does not clip iframe hit-testing (containment only affects paint, not event routing) |
| Prop-drilling `maxHeight` through 4 components | Extra wrapper div broke the flex layout chain |
| `bg-canvas` on InputBar | Cosmetic only — does not affect compositor hit-testing |
| `forwardRef` + ResizeObserver on MessageList | Empty-state early return caused null ref timing gap |

**Lesson**: When iframes intercept clicks despite correct `z-index`, check
whether the iframe or its ancestor has a GPU-promoting property (`transform`,
`will-change`, `opacity < 1`, `filter`, `backdrop-filter`).  The fix is to
promote the victim element to its own GPU layer, not to fight the iframe's
geometry.

---

## Known Limitations

- The artifact parser provides layers of defense (lenient matching, body sniffing,
  flush fallback) — malformed tags degrade gracefully to plain Markdown
- Recharts charts may use invisible grid-line colours on light backgrounds;
  system prompt instructs otherwise but model compliance is imperfect
- No mobile sidebar toggle: sidebar is `fixed` overlay below `lg` breakpoint
- Artifact React sandbox: `export default` stripping is regex-based, may fail
  on complex export patterns
- Switching conversations during active streaming does not cancel the stream
  (content arrives in the original conversation, wasting tokens)
- Stacking multiple `ThemeToggle` instances on one page causes SVG `id` collisions
  (`#crescent-mask`, `#mask-circle`, `#body`, `#rays` — currently safe as only
  one toggle exists)
  (`#crescent-mask`, `#mask-circle`, `#body`, `#rays` — currently safe as only
  one toggle exists)

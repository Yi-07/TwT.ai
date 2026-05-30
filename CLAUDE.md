# CLAUDE.md

## Project Overview

A multi-model AI chat frontend inspired by claude.ai.
Users can switch between AI models (Claude, DeepSeek, ModelScope, and future providers)
with persistent conversation history, streaming responses, per-model settings,
and an Artifact system that renders interactive HTML/React views inline in chat.

## Core Features

- Multi-model switching with a unified provider adapter interface
- Conversation history with sidebar navigation
- Streaming message rendering via SSE (Server-Sent Events)
- Per-model parameter settings (temperature, max tokens, system prompt — session-only, reset to .env on reload)
- Artifact system: model output parsed for `<artifact>` tags and rendered in a
  sandboxed iframe alongside the conversation
- Dual-theme system (Warm Canvas light + Midnight dark) with
  `data-theme` attribute, global CSS colour transitions (1200ms dusk / 1800ms dawn),
  and SVG mask morph icon animation (sun ↔ crescent)
- Persistent storage: conversations in IndexedDB, model settings in localStorage
- Slow-response warning, stop button, and retry after error/cancel
- sandbox → chat communication via `window.sendPrompt()` API
- Structured question collection via `<ask_user>` tabs (multi-question, keyboard nav)
- Copy / edit / retry on user messages
- Debug mode: `NEXT_PUBLIC_DEBUG` gate with unified logger + real-time DebugPanel
- Responsive layout for both desktop and mobile

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript — strict mode, no `any` allowed
- **Styling**: Tailwind CSS v4
- **Package manager**: pnpm
- **Runtime**: Node.js 20+

---

## Project Structure

```
/
├── app/
│   ├── layout.tsx                  # Root layout — font + theme injection
│   ├── page.tsx                    # Entry: redirect → /c/new
│   ├── globals.css                 # Tailwind base + CSS variables
│   └── api/
│       ├── chat/
│       │   └── route.ts            # Chat streaming endpoint
│       └── conversations/
│           └── route.ts            # Conversation CRUD (server storage mode)
│   └── c/
│       └── [id]/
│           └── page.tsx            # Conversation page (Server Component shell)
│
├── components/
│   ├── chat/
│   │   ├── ChatView.tsx              # Client orchestrator: sidebar brand icon, chat, model controls, streaming
│   │   ├── MessageList.tsx         # Iterates messages, renders MessageBubble per item
│   │   ├── MessageBubble.tsx       # Splits segments: text → Markdown, artifact → ArtifactSandbox
│   │   ├── InputBar.tsx            # Text input + send button
│   │   ├── AskCard.tsx             # Structured question tabs (<ask_user> JSON parsing)
│   │   └── StreamingIndicator.tsx  # Animated robot face SVG while waiting for first chunk
│   ├── sidebar/
│   │   ├── ConversationList.tsx    # Full history list
│   │   └── ConversationItem.tsx    # Single history entry with title + timestamp
│   ├── model/
│   │   ├── ModelSwitcher.tsx       # Dropdown to switch active model
│   │   └── ModelSettings.tsx       # temperature / maxTokens / systemPrompt panel
│   ├── theme/
│   │   └── ThemeToggle.tsx         # SVG mask morph icon + theme toggle
│   ├── debug/
│   │   └── DebugPanel.tsx          # Collapsible debug overlay (NEXT_PUBLIC_DEBUG gate)
│   └── artifact/
│       ├── ArtifactSandbox.tsx     # iframe sandbox; handles srcdoc injection + postMessage
│       └── ArtifactToolbar.tsx     # Toolbar above sandbox: title, refresh
│
├── lib/
│   ├── providers/
│   │   ├── base.ts                 # Abstract base implementing ModelProvider
│   │   ├── config.ts               # Centralised provider config + client-safe metas
│   │   ├── index.ts                # Config-driven factory — SERVER ONLY (imports SDKs)
│   │   ├── registry.ts             # Client-safe exports (ProviderMeta, getProviderMetas)
│   │   ├── claude.ts               # Anthropic SDK adapter (receives ProviderConfig)
│   │   └── generic.ts              # Generic OpenAI-compatible adapter (receives ProviderConfig)
│   ├── defaults.ts                 # Default system prompt (artifact + sendPrompt instructions)
│   ├── db/
│   │   └── index.ts                # PostgreSQL adapter (Neon serverless)
│   ├── store/
│   │   ├── conversation.ts         # Zustand: message list, conversation history (dual storage)
│   │   ├── model.ts                # Zustand: active model ID (persisted); settings from .env each session
│   │   ├── storage.ts              # IndexedDB storage adapter for Zustand persist
│   │   └── server-storage.ts       # Server-side storage adapter (PostgreSQL via API)
│   └── utils/
│       ├── stream.ts               # ReadableStream / SSE helper functions
│       ├── parseArtifact.ts        # State-machine parser for <artifact> tags → Segment[]
│       ├── parseAskCard.ts         # JSON extraction from <ask_user> blocks
│       └── logger.ts               # Unified logger with NEXT_PUBLIC_DEBUG gate
│
├── hooks/
│   ├── useStream.ts                # Consumes SSE stream, drives incremental rendering
│   └── useConversation.ts          # Conversation CRUD — wraps store operations
│
├── types/
│   ├── provider.ts                 # ModelProvider interface + ModelOptions
│   ├── conversation.ts             # Message, Conversation types
│   └── artifact.ts                 # ArtifactSegment, ArtifactType — imported by parser + components
│
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── CLAUDE.md
```

---

## Module Dependency Rules (Strictly Enforced)

Dependencies flow in one direction only — lower layers never import from higher layers:

```
types/
  ↑ (all modules depend on types; types depend on nothing)
lib/providers/registry   lib/utils
  ↑                ↑
lib/providers/index   lib/store
  ↑                ↑
app/api/chat       hooks/
                      ↑
                 components/
                      ↑
                  app/pages
```

Additional constraints:

- `lib/providers/index.ts` is the **only** place allowed to call external model APIs.
  It imports SDKs (`@anthropic-ai/sdk`) and must never be imported by client components.
- `lib/providers/registry.ts` exports pure data (provider id, name) with **zero SDK imports**.
  It is the **only** `lib/providers/` file that client components may import.
- `app/api/chat/route.ts` is the **only** server entry point that invokes providers.
- `components/` must never import from `lib/providers/index.ts` or `app/api/` directly.
  Components that need provider metadata import from `lib/providers/registry.ts`.
- `lib/store/` must never import from `hooks/` or `components/`.
- `types/artifact.ts` is imported by `lib/utils/parseArtifact.ts`,
  `components/chat/MessageBubble.tsx`, and `components/artifact/ArtifactSandbox.tsx`.
  Do not merge it into `types/conversation.ts` — the split prevents circular imports.

---

## Provider Architecture (Critical)

All model API calls **must** go through `/lib/providers/`. Never call model APIs directly
from components or other lib files.

The provider layer is split to prevent server-only SDK code from leaking into the client bundle:

- **`index.ts`** (SERVER ONLY): Config-driven factory — reads full `ProviderConfig` (with API keys),
  creates ClaudeProvider or OpenAICompatibleProvider by `config.type`. Only `app/api/chat/route.ts`
  imports this file.
- **`registry.ts`** (CLIENT SAFE): Re-exports `getProviderMetas()` and `ProviderMeta` type from config.
  Contains zero SDK imports. Client components import this file.

Provider configs are centralised in `config.ts`:
- `getProviderConfigs()` — full config with API keys (SERVER ONLY)
- `getProviderMetas()` — id + name only, reads `NEXT_PUBLIC_CUSTOM_PROVIDERS` (CLIENT SAFE)

### Adding a new provider

1. For built-in: add an entry to the `builtIn` array in `config.ts`
2. For custom (user-defined): set `CUSTOM_PROVIDERS` env var (full config) and
   `NEXT_PUBLIC_CUSTOM_PROVIDERS` (id + name for UI display)
3. Add its env var to `.env.example`
4. Do **not** touch UI components or the API route

### ModelProvider interface (`/types/provider.ts`)

```ts
export interface ModelProvider {
  id: string
  name: string
  stream(messages: Message[], options: ModelOptions): Promise<ReadableStream>
  abort(): void
}

export interface ModelOptions {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}
```

---

## Artifact System

### Overview

When the model includes `<artifact>` tags in its response, the message is split into
an ordered array of segments. Each segment is either plain text or an artifact.
`MessageBubble` renders them in sequence — text as Markdown, artifacts as sandboxed iframes.

### Artifact tag format

```xml
<artifact type="react" title="Component name">
// JSX code — default export required
</artifact>

<artifact type="html" title="Page name">
<!-- Full HTML document or fragment -->
</artifact>
```

- `type` is required. Supported values: `react`, `html`, `svg`.
- `title` is required. Used as the label in `ArtifactToolbar`.
- Adding new types only requires updating `ArtifactType` in `types/artifact.ts`
  and the rendering switch in `ArtifactSandbox.tsx`. No other files change.

### Segment types (`/types/artifact.ts`)

```ts
export type ArtifactType = 'react' | 'html' | 'svg'

export type Segment =
  | { type: 'text'; id: string; content: string }
  | { type: 'artifact'; id: string; artifactType: ArtifactType; title: string; content: string }
```

Each segment carries a stable `id` (`text-0`, `artifact-react-0`, etc.) so React
can preserve component instances across streaming re-renders.

### Parser (`/lib/utils/parseArtifact.ts`)

- `ArtifactParser` class (exported) — create per-message instances, not singletons
- State machine with three states: `text` → `tag_open` → `body`
- Per-message `useMemo` creates fresh parser, parses full `message.content`
- **Lenient matching**: type/title accept single/double/no quotes, any attribute order
- **Missing `>` fallback**: detects code keywords after tag to auto-close
- **Missing `type` fallback**: if `type` value is malformed (DeepSeek writes Chinese),
  sniffs body content to determine react/html/svg
- **`flush(hard)`**: `hard=false` preserves tagBuf/bodyBuf during streaming;
  `hard=true` dumps everything as text (used for truncated / persisted messages)
- `placeholder` segment emitted during body state — content-based progress detection (`detectPhase`) shown in UI
- `placeholderIndex` tracking enables replacing the placeholder with the artifact
  segment when `</artifact>` arrives

### Sandbox (`/components/artifact/ArtifactSandbox.tsx`)

- Renders a sandboxed `<iframe>` with `sandbox="allow-scripts"` (no allow-same-origin)
- Injects content via the `srcdoc` attribute — never via `src` or `innerHTML`
- For `type="react"`: injects Babel Standalone + React runtime from CDN, then the JSX
- For `type="html"`: injects the HTML string directly
- For `type="svg"`: wraps SVG in a minimal HTML shell
- Communicates with the parent via `window.postMessage` only
  - Sandbox → parent: `{ type: 'resize', height: number }`
  - Sandbox → parent: `{ type: 'sendPrompt', text: string }`
  - Parent → sandbox: `{ type: 'theme', value: 'light' | 'dark' }`
- Exposes `window.sendPrompt(text)` in sandbox global scope (injected before all other scripts)
- `prepareReactCode()` auto-injects Recharts destructuring (21 components) to prevent
  `ResponsiveContainer is not defined` errors from model-generated code
- Error logging: `window.addEventListener('error', ...)` + `console.error` proxy
  → `postMessage({ type: 'sandbox-error', error })` → parent logs full stack to console
- Dependencies vendored in `public/vendor/` — no external CDN calls from sandbox:
  `react.umd.js`, `react-dom.umd.js`, `babel.min.js`, `recharts.umd.js`,
  `lodash.umd.js`, `prop-types.umd.js`

### Toolbar (`/components/artifact/ArtifactToolbar.tsx`)

Sits above the iframe. Contains: artifact title, copy source, download, refresh,
expand/collapse. Interacts only via props — no store access. Toolbar fades in on
mouse hover; fully transparent by default to minimize visual noise.

### System prompt instruction for artifact output

Defined in `lib/defaults.ts` — two compressed prompts (~1200 tokens total, down from ~2500):
- `SYSTEM_PROMPT_TEXT` — minimal prompt forbidding artifact tags (10 lines)
- `SYSTEM_PROMPT_ARTIFACT` — unified prompt with decision framework:
  model decides text vs artifact via context (not keyword matching).
  Two-step type decision tree: svg (static/visual) → react (component model) → html (default).
  Navigational SVG diagrams MUST have clickable nodes with sendPrompt().
  Includes <ask_user> format, CDN library support, chart styling (# prefix, 3:1 contrast),
  VISUAL DESIGN rules. `classifyIntent()` removed — model judgement > heuristics.

---

## Data Flow: Streaming + Artifact Rendering

```
User input
  → InputBar (UI)
  → useConversation hook (appends user message to Zustand store)
  → POST /api/chat
  → Provider Registry → active Provider
  → ReadableStream (SSE)
  → useStream hook (reads chunks, RAF-throttled → rawContent)
  → useLayoutEffect syncs rawContent into store placeholder message (stable msgId)
  → MessageBubble (key=msgId) calls ArtifactParser on message.content
  → Segment[] renders in order:
      Segment.type === 'text'        → <ReactMarkdown>
      Segment.type === 'placeholder' → animated "Generating..." indicator
      Segment.type === 'artifact'    → <ArtifactToolbar> + <ArtifactSandbox>
```

**Key design**: The assistant message is created in the store BEFORE streaming starts
with `content=""`. During streaming, `rawContent` is synced into this same message
via `useLayoutEffect` (synchronous before paint). The message's React key (msgId)
remains stable from creation through streaming to persistence — the iframe is never
unmounted/remounted. Text segments stream character-by-character. Artifact segments
show a placeholder while code is being generated, then the iframe appears once
`</artifact>` arrives.

---

## Common Pitfalls & Lessons

### React State & Refs

- **Never read a ref inside a `setState` updater function.** React calls updaters
  asynchronously; by then the ref may have been cleared. Always capture the ref
  value into a local variable first, then use the local in the updater.
  Example: `const v = ref.current; ref.current = ""; setState(prev => prev + v);`

- **`useLayoutEffect` for synchronous store sync.** When rawContent must land in
  the Zustand store before the browser paints the next frame, `useEffect` is not
  enough — React may batch `setRawContent` and the effect into separate renders.
  Use `useLayoutEffect` to guarantee both updates land in the same frame.

- **Module-level singletons are poison for multi-instance rendering.**
  The module-level `parseArtifact()` / `flushArtifact()` singleton caused
  interference when multiple messages rendered simultaneously. Each message
  now instantiates its own `ArtifactParser` via `useMemo`.

### Artifact Parser

- **Models frequently omit `>` from the opening tag.** A `>`-less tag
  like `<artifact type="react" title="X"export...` keeps the parser in
  `tag_open` forever. The parser now detects code keywords (`export`,
  `function`, `const`, etc.) immediately after the title attribute and
  auto-closes the tag.

- **Use `flush(false)` during streaming, `flush(true)` for persisted messages.**
  `flush(false)` only drains `textBuf` — preserves `tagBuf` and `bodyBuf`
  so incomplete tags aren't corrupted. `flush(true)` dumps everything,
  converting truncated body content into a markdown code block.

- **Lenient attribute matching is required for DeepSeek.** The parser
  accepts `type="react"`, `type='react'`, and `type=react` (unquoted).
  If `type` is missing or malformed, the body is sniffed for type
  (`<svg` → svg, `<!DOCTYPE`/`<html` → html, default → react).

### Streaming Pipeline

- **Messages MUST be rendered from the store, not as a separate bubble.**
  Using `key="streaming"` for live content and `key={msgId}` for persisted
  content causes React to unmount/remount the iframe. Syncing rawContent
  directly into the store placeholder (same `key`) avoids this entirely.

- **The `streaming` prop tells `MessageBubble` which flush mode to use.**
  Prop chain: `ChatView` → `MessageList` → `MessageBubble`. During
  streaming: `flush(false)`. After persistence: `flush(true)` (shows
  truncated code).

### InputBar / Layout

- **InputBar needs `relative z-10`** — the MessageList overflow container
  can overlap the InputBar by a few pixels at the bottom. Without a
  stacking context, clicks in that zone go to the message area instead
  of the textarea.

### SVG DOM Manipulation with React

- **Ref values persist across StrictMode unmount/remount, DOM state does not.**
  When React StrictMode unmounts and remounts a component, ref values survive
  but SVG DOM elements are destroyed and recreated from JSX defaults. An init
  guard based on ref state (e.g. `prevDark.current === null`) will fail on the
  remount because the ref still holds the previous mount's value, but the DOM
  is fresh. **Use DOM state for init guards** (`raysG.children.length === 0`),
  not refs.

- **`mounted` must be in the dependency array** when an effect initialises
  SVG DOM that depends on the component being visible. If `useEffect` only
  depends on `[isDark]` and `isDark` doesn't change between the unmounted
  (placeholder) render and the mounted (SVG-present) render, the effect
  won't re-fire. Add `mounted` to the dep array: `[isDark, mounted]`.

- **Use `transitionend` events, not `setTimeout`, for serial SVG animation
  stages.** setTimeout delay must match CSS transition duration exactly;
  they drift apart under heavy load. `transitionend` fires when the browser
  actually finishes the transition, regardless of timing.

### SVG `<style>` + `@keyframes` Are Global

- **SVG `<defs>` IDs are scoped per `<svg>` element — safe to reuse names.**
- **SVG `<style>` blocks and `@keyframes` are NOT scoped** — they are injected
  into the global CSSOM. Multiple components using the same class or keyframe
  names will silently override each other.
- **Fix:** use unique prefixes per component (e.g. `si-` for StreamingIndicator,
  `sb-` for Sidebar). Verify both components can render simultaneously without
  animation interference.

### Model Output Quality (DeepSeek-specific)

- DeepSeek frequently produces malformed artifact tags (wrong `type`,
  missing `=` sign, missing `>`). Our parser has layers of fallback for
  each pattern. If all fallbacks fail, the content renders as plain
  Markdown — never crashes.
- For artifact code generation, Claude and Qwen models produce more
  reliable JSX syntax than DeepSeek.

---

## Skills

- **frontend-design**: Read before developing any UI component — applies to all files
  under components/chat/, components/sidebar/, components/model/, components/artifact/
- **context7**: Read when using Next.js 15, Tailwind v4, or Zustand APIs — ensures
  usage matches current library documentation. When in doubt, check before writing
  implementation code.

---

## Git Workflow

### Branch naming

- `feat/xxx` — new feature
- `fix/xxx` — bug fix
- `chore/xxx` — config, deps, tooling
- `refactor/xxx` — internal restructure with no behaviour change

### Commit format

Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`

### Rules

- Never commit `.env` or any file containing API keys
- Run `pnpm tsc --noEmit && pnpm lint` before every commit
- Each checkpoint below must be a separate commit — do not squash across checkpoints

### Development checkpoints (commit after each)

Complete these in order. Do not start the next checkpoint until the current one passes
`pnpm tsc --noEmit` and `pnpm lint` with zero errors.

```
chore: init Next.js 15 project with TypeScript, Tailwind v4, pnpm
  ↓
feat: add type definitions — provider, conversation, artifact
  ↓
feat: implement ModelProvider base + DeepSeek adapter
  ↓
feat: implement Claude adapter
  ↓
feat: implement /api/chat streaming route
  ↓
feat: add Zustand stores — conversation and model
  ↓
feat: implement useStream and useConversation hooks
  ↓
feat: build core chat UI — MessageList, MessageBubble, InputBar, StreamingIndicator
  ↓
feat: add sidebar — ConversationList, ConversationItem
  ↓
feat: add ModelSwitcher and ModelSettings
  ↓
feat: implement parseArtifact parser with streaming support
  ↓
feat: build ArtifactSandbox and ArtifactToolbar components
  ↓
feat: integrate artifact rendering into MessageBubble
  ↓
feat: add React (Babel) runtime support inside sandbox
  ↓
chore: finalize .env.example, README, and system prompt instructions
	  ↓
	feat: assemble pages — ChatView orchestrator + conversation route
```

---

## Commands

```bash
pnpm dev                     # Start dev server (localhost:3000)
pnpm build                   # Production build
pnpm tsc --noEmit            # Type check — run after every code change
pnpm lint                    # ESLint check
pnpm test                    # Run all tests (vitest)
pnpm test -- <file>.test.ts  # Run a single test file
```

### After every code change

1. `pnpm tsc --noEmit` — fix all type errors before continuing
2. `pnpm lint` — fix all lint warnings before continuing
3. Run the related test file if one exists

---

## Code Style

- Named exports only — no default exports for components
- Prefer Server Components; add `"use client"` only when strictly necessary
  (event handlers, hooks, browser APIs)
- No inline styles — use Tailwind utility classes exclusively
- No hardcoded colors or sizes — use Tailwind design tokens
- Error boundaries required for all async Server Components
- All async functions must handle errors explicitly (no silent catch blocks)
- Streaming: use `ReadableStream` + SSE only — no polling
- `useEffect` is permitted for subscriptions and stream lifecycle management
  (setup + cleanup of a running stream). It must not be used to fetch initial data —
  use Server Components for that.

---

## Environment Variables

See `.env.example` for the full list. All keys are server-side only unless prefixed
with `NEXT_PUBLIC_`.

```bash
ANTHROPIC_API_KEY=      # Claude (Anthropic)
CLAUDE_MODEL=           # Claude model version (e.g. claude-sonnet-4-6)
CLAUDE_BASE_URL=        # Optional proxy/relay URL for Claude API
DEEPSEEK_API_KEY=       # DeepSeek
DEEPSEEK_MODEL=         # DeepSeek model version (e.g. deepseek-chat)
DASHSCOPE_API_KEY=      # ModelScope (Alibaba Cloud DashScope)
MODELSCOPE_MODEL=       # ModelScope model version (e.g. qwen-plus)
# Future providers: add key here + register in /lib/providers/index.ts and /lib/providers/registry.ts
NEXT_PUBLIC_DEFAULT_PROVIDER=        # Default AI provider (claude | deepseek | modelscope)
NEXT_PUBLIC_DEBUG=false              # Enable debug panel + model settings panel + verbose logging
NEXT_PUBLIC_DEFAULT_TEMPERATURE=1    # Default temperature (route.ts + Settings panel)
NEXT_PUBLIC_DEFAULT_MAX_TOKENS=131072 # Default max output tokens — 128K (Claude max)

# Server-side persistence (optional — unset defaults to browser IndexedDB)
NEXT_PUBLIC_STORAGE_MODE=server      # Set to "server" for PostgreSQL multi-device sync
ACCESS_SECRET=                       # Server-side auth token for /api/conversations
NEXT_PUBLIC_ACCESS_SECRET=           # Client-side auth token (embedded in bundle)
DATABASE_URL=                        # Neon PostgreSQL connection string
ACCESS_PASSWORD=                     # If set, password-gates the entire deployment

NEXT_PUBLIC_APP_URL=                 # e.g. http://localhost:3000
```

---

## Important Rules (Do Not Violate)

- **Never** call model APIs directly from components or outside `/lib/providers/`
- **Never** import `lib/providers/index.ts` (or any file that imports an SDK) from
  client components — use `lib/providers/registry.ts` for provider metadata
- **Never** use `useEffect` for initial data fetching — use Server Components
- **Never** use `any` type — use `unknown` and narrow it
- **Never** add a new npm package without confirming with the user first
- **Never** modify `/types/provider.ts` without discussing the interface change first
- **Never** merge `types/artifact.ts` into `types/conversation.ts` — kept separate
  to avoid circular imports between parser, sandbox, and message components
- **Always** handle SSE disconnection, timeout, and error states in streaming
- **Always** keep UI components decoupled from provider logic — swapping a model
  should require zero UI changes
- **Always** inject artifact content via `srcdoc` — never via `src`, `innerHTML`,
  or dynamic `<script>` injection into the parent page
- **Always** add new provider metadata to both `index.ts` (constructor) and
  `registry.ts` (pure data) when adding a provider
- **Always** add new provider env vars for both API key and model version
  (e.g. `PROVIDER_API_KEY` + `PROVIDER_MODEL`) to `.env.example`
- **Always** capture ref values into local variables before clearing the ref
  and passing to `setState` — React updaters run asynchronously
- **Always** use `useLayoutEffect` (not `useEffect`) for state syncs that must
  land in the same frame as the triggering render
- **Always** commit at every checkpoint listed above before proceeding — this enables
  clean rollback if a later checkpoint introduces a regression

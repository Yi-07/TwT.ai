# CLAUDE.md

## Project Overview

A multi-model AI chat frontend inspired by claude.ai.
Users can switch between AI models (Claude, DeepSeek, and future providers)
with persistent conversation history, streaming responses, per-model settings,
and an Artifact system that renders interactive HTML/React views inline in chat.

## Core Features

- Multi-model switching with a unified provider adapter interface
- Conversation history with sidebar navigation
- Streaming message rendering via SSE (Server-Sent Events)
- Per-model parameter settings (temperature, max tokens, system prompt)
- Artifact system: model output parsed for `<artifact>` tags and rendered in a
  sandboxed iframe alongside the conversation
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
│       └── chat/
│           └── route.ts            # Only API entry point; calls provider, returns SSE
│   └── c/
│       └── [id]/
│           └── page.tsx            # Conversation page (Server Component shell)
│
├── components/
│   ├── chat/
│   │   ├── ChatView.tsx              # Client orchestrator: wires sidebar, chat, model controls, streaming
│   │   ├── MessageList.tsx         # Iterates messages, renders MessageBubble per item
│   │   ├── MessageBubble.tsx       # Splits segments: text → Markdown, artifact → ArtifactSandbox
│   │   ├── InputBar.tsx            # Text input + send button
│   │   └── StreamingIndicator.tsx  # Typing animation shown while SSE stream is open
│   ├── sidebar/
│   │   ├── ConversationList.tsx    # Full history list
│   │   └── ConversationItem.tsx    # Single history entry with title + timestamp
│   ├── model/
│   │   ├── ModelSwitcher.tsx       # Dropdown to switch active model
│   │   └── ModelSettings.tsx       # temperature / maxTokens / systemPrompt panel
│   └── artifact/
│       ├── ArtifactSandbox.tsx     # iframe sandbox; handles srcdoc injection + postMessage
│       └── ArtifactToolbar.tsx     # Toolbar above sandbox: title, refresh, expand button
│
├── lib/
│   ├── providers/
│   │   ├── base.ts                 # Abstract base implementing ModelProvider
│   │   ├── index.ts                # Provider registry + factory — SERVER ONLY (imports SDKs)
│   │   ├── registry.ts             # Provider metadata (id, name) — CLIENT SAFE, no SDK imports
│   │   ├── claude.ts               # Anthropic SDK adapter
│   │   └── deepseek.ts             # DeepSeek adapter (OpenAI-compatible)
│   ├── defaults.ts                 # Default system prompt (artifact instructions)
│   ├── store/
│   │   ├── conversation.ts         # Zustand: message list, conversation history
│   │   └── model.ts                # Zustand: active model ID, per-model settings
│   └── utils/
│       ├── stream.ts               # ReadableStream / SSE helper functions
│       └── parseArtifact.ts        # Parses <artifact> tags → Segment[]
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

The provider layer is split into two files to prevent server-only SDK code from
leaking into the client bundle:

- **`index.ts`** (SERVER ONLY): Imports provider SDKs, provides `getProvider()` for
  server-side instantiation. Only `app/api/chat/route.ts` imports this file.
- **`registry.ts`** (CLIENT SAFE): Pure data — exports `ProviderMeta` type and
  `getProviderMetas()`. Contains zero SDK imports. Client components import this file.

If a client component imports `index.ts`, the entire SDK tree gets bundled into the
browser, causing `UnhandledSchemeError: node:child_process`. Always use `registry.ts`
for client-side provider lookups.

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

### Adding a new provider

1. Create `/lib/providers/<name>.ts` implementing `ModelProvider`
2. Register it in `/lib/providers/index.ts` (constructor map)
3. Add its metadata to `/lib/providers/registry.ts` (id + name — pure data)
4. Add its env var to `.env.example`
5. Do **not** touch UI components or the API route

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
  | { type: 'text'; content: string }
  | { type: 'artifact'; artifactType: ArtifactType; title: string; content: string }
```

### Parser (`/lib/utils/parseArtifact.ts`)

- Input: raw string (may be partial during streaming)
- Output: `Segment[]`
- Scans for `<artifact ...>` opening tags and `</artifact>` closing tags
- Content outside tags → `{ type: 'text' }`
- Content inside tags → `{ type: 'artifact', artifactType, title, content }`
- Must handle partial/incomplete tags gracefully during streaming
  (buffer the incomplete tag, do not emit until closing tag is confirmed)

### Sandbox (`/components/artifact/ArtifactSandbox.tsx`)

- Renders a sandboxed `<iframe>` with `sandbox="allow-scripts"` (no allow-same-origin)
- Injects content via the `srcdoc` attribute — never via `src` or `innerHTML`
- For `type="react"`: injects Babel Standalone + React runtime from CDN, then the JSX
- For `type="html"`: injects the HTML string directly
- For `type="svg"`: wraps SVG in a minimal HTML shell
- Communicates with the parent via `window.postMessage` only
  - Sandbox → parent: `{ type: 'resize', height: number }`
  - Parent → sandbox: `{ type: 'theme', value: 'light' | 'dark' }`
- CDN allowlist (loaded inside the sandbox only):
  - `https://unpkg.com/`
  - `https://cdn.jsdelivr.net/`
  - `https://cdnjs.cloudflare.com/`

### Toolbar (`/components/artifact/ArtifactToolbar.tsx`)

Sits above the iframe. Contains: artifact title, refresh button, expand/collapse button.
Interacts only with `ArtifactSandbox` via props — no store access.

### System prompt instruction for artifact output

Include the following instruction in the model's system prompt so it uses the correct format:

```
When your response includes interactive UI, a visualization, or runnable code meant to be
rendered, wrap it in an artifact tag:

<artifact type="react" title="Short descriptive title">
// your JSX here — must have a default export
</artifact>

Use type="html" for plain HTML, type="react" for JSX components.
Do not use artifact tags for code examples that are meant to be read, not rendered.
```

---

## Data Flow: Streaming + Artifact Rendering

```
User input
  → InputBar (UI)
  → useConversation hook (appends user message to Zustand store)
  → POST /api/chat
  → Provider Registry → active Provider
  → ReadableStream (SSE)
  → useStream hook (reads chunks, appends to rawContent)
  → parseArtifact(rawContent) → Segment[]
  → MessageBubble renders Segment[] in order:
      Segment.type === 'text'     → <ReactMarkdown>
      Segment.type === 'artifact' → <ArtifactToolbar> + <ArtifactSandbox>
```

`useStream` calls `parseArtifact` on every new chunk so the UI updates incrementally.
Text segments stream character-by-character. Artifact segments are held until the
closing `</artifact>` tag is received, then the iframe is mounted.

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
DEEPSEEK_API_KEY=       # DeepSeek
# Future providers: add key here + register in /lib/providers/index.ts and /lib/providers/registry.ts
NEXT_PUBLIC_APP_URL=    # e.g. http://localhost:3000
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
- **Always** commit at every checkpoint listed above before proceeding — this enables
  clean rollback if a later checkpoint introduces a regression

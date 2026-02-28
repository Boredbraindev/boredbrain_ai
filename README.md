# Bored Brain

Bored Brain is an AI-powered meta search copilot that blends LLM reasoning with real-time web, media, finance, and location data. It ships both a browser experience and a Telegram Mini App so you can ask, follow up, and automate research anywhere.

[Try Bored Brain at boredbrain.ai](https://boredbrain.ai)

## Table of Contents
- [Overview](#overview)
- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Feature Modules](#feature-modules)
- [First Steps](#first-steps)
- [Getting Started](#getting-started)
- [Usage Examples](#usage-examples)
- [Developer Tooling](#developer-tooling)
- [Deployment](#deployment)

## Overview
Bored Brain orchestrates a multi-model AI stack (Grok, Gemini, Claude, GPT-4o, Groq/Qwen and more) with streaming tool invocations. Users converse through the chat workspace in `components/chat-interface.tsx`, while `/app/api/search/route.ts` routes every question to the right search group, pulls fresh context from web connectors, and streams answers back to the UI. Authentication is handled by Better Auth with support for GitHub, Google, Twitter, and Telegram mini-app logins.

## Highlights

### Search-first copilot
- Multi-turn chat UI with history, follow-up suggestions, visibility controls, and model switching (`components/chat-interface.tsx`, `components/messages.tsx`, `components/chat-history-drawer.tsx`).
- Intelligent routing across topical groups (web, academic, code, finance, travel, media, etc.) with guardrails and rate limits defined in `lib/assistant-groups.ts` and `lib/constants.ts`.
- Resumable streaming pipeline so partial responses survive reloads (`app/api/search/route.ts`, `components/data-stream-provider.tsx`, `lib/performance-cache.ts`).

### Built-in tools & vertical data
- Web and parallel web search, Firecrawl crawling, Exa semantic retrieval (`lib/tools/web-search.ts`, `lib/tools/extreme-search.ts`).
- Media and entertainment queries via YouTube, X, Reddit, TMDB (`lib/tools/youtube-search.ts`, `lib/tools/x-search.ts`, `lib/tools/reddit-search.ts`, `lib/tools/movie-tv-search.ts`, `lib/tools/trending-movies.ts`).
- Finance and crypto dashboards with charts, OHLC, wallet insights (`components/interactive-stock-chart.tsx`, `lib/tools/stock-chart.ts`, `lib/tools/crypto-tools.ts`, `components/wallet-analyzer.tsx`).
- Geo and travel results including maps, weather, and flight tracking (`components/interactive-maps.tsx`, `lib/tools/map-tools.ts`, `lib/tools/weather.ts`, `lib/tools/flight-tracker.ts`).
- Prompt enhancement, translation, code execution, and memory tools for power users (`app/actions.ts`, `lib/tools/text-translate.ts`, `lib/tools/code-interpreter.ts`, `lib/tools/supermemory.ts`).

### Personalization & automation
- Supermemory-powered long-term recall and embeddings storage (`lib/tools/supermemory.ts`, `lib/memory-actions.ts`).
- Usage accounting, limits, and Pro upgrades handled through server actions (`app/actions.ts`, `lib/db/queries.ts`).
- Signals (scheduled automations) UI to create recurring prompts, monitor status, and re-run jobs (`app/signals/page.tsx`, `app/actions.ts:createSignal`).

### Multichannel delivery
- First-class Telegram Mini App with secure auth and same chat stack (`app/telegram/page.tsx`, `components/telegram-auth-gate.tsx`, `lib/secure-telegram-plugin.ts`).
- Shareable landing flows built with Shadcn UI (`components/navbar.tsx`).
- Email notifications via Resend and Upstash QStash scheduling (`components/emails`, `app/actions.ts:generateSpeech`, `lib/telegram-notifications.ts`).

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions) with React 19 and Suspense streaming.
- **Design System**: Tailwind CSS + Shadcn/UI + Radix primitives for accessible components.
- **AI & Tooling**: Vercel AI SDK orchestrating xAI Grok, Gemini, Claude, Groq, OpenAI, ElevenLabs, Daytona code sandboxes, Tavily, Exa, Firecrawl, Upstash QStash.
- **Data & Storage**: PostgreSQL via Drizzle ORM (`lib/db/schema.ts`), Upstash Redis for caching/resumable streams, Vercel Blob for uploads.
- **Auth & Billing**: Better Auth (GitHub/Google/Twitter/Telegram), Polar subscriptions, Upstash rate limits, Pro gating flags.
- **Infra**: Vercel Functions, Dockerfile targeting Node 22, optional Neon/Postgres. Weather (OpenWeather), Maps (Google Maps/Leaflet), TMDB, CoinGecko.

## Feature Modules

| Area | Description | Key files |
| --- | --- | --- |
| Chat & session management | Conversational UI, history, settings, streaming state | `components/chat-interface.tsx`, `components/chat-dialogs.tsx`, `components/data-stream-provider.tsx` |
| Search orchestration | Converts user messages to model/tool calls, saves chats | `app/api/search/route.ts`, `lib/db/queries.ts`, `app/actions.ts` |
| Tools & connectors | Pluggable AI tools for vertical data sources | `lib/tools/*.ts`, `components/tool-invocation-list-view.tsx` |
| Automation signals | Scheduled prompts, frequency settings, status boards | `app/signals/page.tsx`, `app/signals/hooks/use-signals.ts`, `app/actions.ts:createSignal` |
| Authentication & user context | Better Auth, Telegram gate, user state provider | `contexts/user-context.tsx`, `components/telegram-auth-gate.tsx`, `lib/auth.ts` |
| Database & migrations | Drizzle schema, migrations, index helpers | `lib/db/schema.ts`, `drizzle/migrations`, `create_indexes.sql` |
| Notifications | Email templates, voice synthesis | `components/emails/*`, `app/actions.ts:generateSpeech`, `lib/telegram-notifications.ts` |

Explore additional product docs under the project root (e.g. `TELEGRAM_SETUP.md`, `TELEGRAM_NOTIFICATIONS.md`, `UI_IMPROVEMENTS_SUMMARY.md`) for context on product decisions.

## First Steps

- **Bootstrap env files**: Duplicate `.env.example` if present or start a `.env.local` based on `env/server.ts` and `env/client.ts`. Commit a personal copy of secrets outside git (e.g. using 1Password). Ensure `ALLOWED_ORIGINS` includes your local Vercel preview URL for webhook callbacks.
- **Seed database**: Use `docker compose up postgres` (if available) or point `DATABASE_URL` to Neon/Supabase. Run `pnpm dlx drizzle-kit push` followed by `pnpm exec drizzle-kit up` to apply pending migrations.
- **Telegram Mini App quirks**:
  - Obtain a bot token from [@BotFather](https://t.me/BotFather) and set `TELEGRAM_BOT_TOKEN` plus `ALLOWED_ORIGINS`.
  - Use `pnpm mock:telegram` to generate signed payloads for local login without the Telegram client.
  - When testing in the real Telegram WebView, expose your dev server with `ngrok http 3000` and update `TELEGRAM_SETUP.md` instructions, otherwise auth signatures will fail.
  - Mini app disables connectors (`lib/connectors.tsx`); verify alternate flows in `components/telegram-auth-gate.tsx` before shipping changes.
- **Run the app**: `pnpm install` then `pnpm dev`. Confirm the chat loads at `/sign-in` and that `/api/health` (if added) returns 200.
- **Debug streaming**: Use the browser console to monitor `globalStreamContext` logs from `app/api/search/route.ts` when testing resumable responses. If streams hang, flush Redis (`redis-cli FLUSHDB`) in your dev instance.

## Getting Started

### Prerequisites
- Node.js 22.x (matches the Dockerfile) and pnpm 10 (via `corepack enable pnpm`).
- PostgreSQL database (local Docker or managed service) and an Upstash Redis instance.
- API keys for the providers listed in `env/server.ts`. At minimum you need keys for xAI, OpenAI, Anthropic, Groq, Google Generative AI, Daytona, Exa, Tavily, OpenWeather, Firecrawl, Redis, Upstash, TMDB, CoinGecko, QStash, Resend, Supermemory, Telegram bot, and OAuth clients.

### Environment variables
Create `.env.local` (used by Drizzle and Next.js) with the required secrets. Use `env/server.ts` and `env/client.ts` as the authoritative list. A minimal local setup looks like:

```bash
# Core AI providers
XAI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENROUTER_API_KEY=...

# App + persistence
DATABASE_URL=postgres://user:pass@localhost:5432/boredbrain
REDIS_URL=redis://...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
BETTER_AUTH_SECRET=...

# 3rd party integrations
DAYTONA_API_KEY=...
EXA_API_KEY=...
TAVILY_API_KEY=...
OPENWEATHER_API_KEY=...
TMDB_API_KEY=...
FIRECRAWL_API_KEY=...

# Messaging & storage
BLOB_READ_WRITE_TOKEN=...
QSTASH_TOKEN=...
RESEND_API_KEY=...
TELEGRAM_BOT_TOKEN=...

# Optional but recommended
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

When running the Telegram mini app locally, also populate the OAuth client IDs and secrets (GitHub, Google, Twitter) and `ALLOWED_ORIGINS`.

### Install & run

```bash
pnpm install
pnpm drizzle-kit generate # optional, updates migrations if schema changed
pnpm dev
```

The development server runs on http://localhost:3000. Server Actions and Edge runtime routes require the environment variables above; missing values will throw at runtime.

## Usage Examples

### 1. Conversational search (UI)
1. Visit http://localhost:3000/sign-in and authenticate (email or Telegram).
2. Choose a model and search group from the navbar.
3. Ask a question such as “Plan a 3-day trip to Kyoto with current weather and flight options.”
4. Watch tool invocations stream in the side panel. Toggle public/private visibility with the lock icon.

### 2. Programmatic search API

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Summarize the latest research on quantum error correction"}],
    "model": "boredbrain-default",
    "group": "web",
    "timezone": "America/Los_Angeles",
    "id": null,
    "selectedVisibilityType": "private",
    "isCustomInstructionsEnabled": true,
    "searchProvider": "firecrawl",
    "selectedConnectors": []
  }'
```

The endpoint streams Server-Sent Events; when invoked via curl you will receive JSON patches that the client stitches into a full response. Persistent chats are written through `saveChat` and `saveMessages` in `lib/db/queries.ts`.

### 3. Speech transcription

```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@speech.wav"
```

The request uses ElevenLabs Scribe (`app/api/transcribe/route.ts`) to convert audio to text, returning `{ "text": "..." }`.

## Developer Tooling
- `pnpm lint` – ESLint with Next.js rules.
- `pnpm fix` – Prettier formatting pass.
- `pnpm test` – Vitest suite (`tests/secure-telegram-plugin.test.ts`).
- `pnpm knip` – Dependency & unused code analysis.
- `pnpm mock:telegram` – Simulates Telegram sign-in for local development.

Drizzle migrations live in `drizzle/migrations`. To apply in CI or production, run `pnpm dlx drizzle-kit push`.

## Deployment
- **Vercel**: Uses App Router functions; ensure required env vars and `NODE_ENV=production`.
- **Docker**: Multi-stage `Dockerfile` builds a standalone Next.js server on Node 22 Alpine. Provide `.env` at build time before running `docker compose up`.
- Background queues (QStash), notifications (Resend), and Redis streaming must be provisioned for production parity.

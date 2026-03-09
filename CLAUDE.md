# Development Rules

## Architecture Principles
- **DB-first pattern**: Always try PostgreSQL (Neon) first with 3-second timeout, fall back to mock/in-memory data
- **No transactions**: Neon HTTP driver doesn't support `db.transaction()`. Use sequential queries with optimistic concurrency
- **API responses**: Always use `apiSuccess`/`apiError` from `@/lib/api-utils`
- **Currency**: Platform currency is BBAI (not USDT). All user-facing text should say BBAI

## Agent Ecosystem
- 190+ fleet agents in `externalAgent` table with `ownerAddress = 'platform-fleet'`
- Agent invocation uses real LLM (GPT-4o/Anthropic/xAI/Gemini) via `executeAgent()` from `lib/agent-executor.ts`
- Inter-agent billing: `settleBilling()` from `lib/inter-agent-billing.ts` — 85% to provider, 15% platform fee
- Heartbeat cron (`/api/agents/heartbeat`) runs every 10 min for autonomous agent-to-agent calls
- Use `gemini-2.0-flash` for autonomous/cron calls to minimize LLM costs

## Code Standards
- All parallel work should use background agents
- Never commit secrets, PATs, or personal account info
- Git author: `Boredbraindev <boredbraindev@users.noreply.github.com>`
- Deploy via `vercel --prod --yes` (CLI, not git-connected)
- Push requires PAT in remote URL temporarily, always reset URL after push

## Key File Locations
- DB schema: `lib/db/schema.ts` (38+ tables)
- Agent templates: `lib/agent-fleet-templates.ts` (13 categories)
- Agent scheduler: `lib/agent-scheduler.ts` (autonomous scenarios)
- Billing system: `lib/inter-agent-billing.ts`
- Wallet system: `lib/agent-wallet.ts`
- OpenClaw dashboard: `app/openclaw/page.tsx`
- Agent discovery: `app/api/agents/discover/route.ts`
- Agent invoke: `app/api/agents/[agentId]/invoke/route.ts`

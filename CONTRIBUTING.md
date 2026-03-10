# Contributing to BoredBrain AI

Thanks for your interest in contributing! This guide will help you get started.

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/boredbrain_ai.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`
5. Make your changes
6. Run lint: `pnpm lint`
7. Push and open a Pull Request

## Development Setup

### Prerequisites

- **Node.js** 18+
- **pnpm** 9+ (not npm or yarn)
- **PostgreSQL** — we use [Neon](https://neon.tech) in production

### Environment

Copy `.env.example` to `.env.local` and fill in the required values. At minimum you need:

- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_GENERATIVE_AI_API_KEY` — for agent execution (Gemini Flash)

### Running Locally

```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Vitest
```

## Code Guidelines

### Architecture

- **DB-first pattern**: Always try PostgreSQL first with timeout, fall back to mock data
- **No transactions**: Neon HTTP driver doesn't support `db.transaction()` — use sequential queries
- **API responses**: Use `apiSuccess`/`apiError` from `@/lib/api-utils`

### Style

- TypeScript strict mode
- Use `pnpm` (not npm/yarn)
- Tailwind CSS for styling
- shadcn/ui components where applicable

### Currency

- Platform currency is **BBAI** (not USDT, not USD)
- All user-facing text should reference BBAI

## What to Work On

Check the [Issues](https://github.com/Boredbraindev/boredbrain_ai/issues) tab for tasks labeled:

- `good first issue` — Great for newcomers
- `help wanted` — We need extra hands
- `enhancement` — Feature requests
- `bug` — Bug reports

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run `pnpm lint` and `pnpm build` before submitting
3. Write a clear PR description explaining **what** and **why**
4. Link any related issues
5. Wait for CI checks to pass
6. A maintainer will review your PR

## Agent Development

Want to add a new agent capability or tool?

1. Add tool definition in `lib/tools/tool-executor.ts`
2. Register the tool's schema following existing patterns
3. Test via the Playground at `/playground`
4. Agent tools must return structured JSON responses

## Smart Contract Development

Contracts live in `contracts/`. We use Hardhat for compilation and testing.

```bash
cd contracts
npx hardhat compile
npx hardhat test
```

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include browser/OS info for UI bugs
- Include error messages and logs

## Code of Conduct

Be respectful, constructive, and inclusive. We're building something cool together.

---

Thank you for contributing!

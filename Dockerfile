# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable standalone output for Docker
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time env (dummy values - real values come from .env.docker at runtime)
ENV DATABASE_URL=postgresql://bbai:bbai_secret_2024@postgres:5432/boredbrain
ENV USE_LOCAL_DB=1
ENV REDIS_URL=redis://redis:6379
ENV XAI_API_KEY=dummy
ENV OPENAI_API_KEY=dummy
ENV ANTHROPIC_API_KEY=dummy
ENV GROQ_API_KEY=dummy
ENV GOOGLE_GENERATIVE_AI_API_KEY=dummy
ENV DAYTONA_API_KEY=dummy
ENV BETTER_AUTH_SECRET=docker-build-secret
ENV GITHUB_CLIENT_ID=dummy
ENV GITHUB_CLIENT_SECRET=dummy
ENV GOOGLE_CLIENT_ID=dummy
ENV GOOGLE_CLIENT_SECRET=dummy
ENV TWITTER_CLIENT_ID=dummy
ENV TWITTER_CLIENT_SECRET=dummy
ENV UPSTASH_REDIS_REST_URL=https://dummy.upstash.io
ENV UPSTASH_REDIS_REST_TOKEN=dummy
ENV ELEVENLABS_API_KEY=dummy
ENV TAVILY_API_KEY=dummy
ENV EXA_API_KEY=dummy
ENV VALYU_API_KEY=dummy
ENV TMDB_API_KEY=dummy
ENV YT_ENDPOINT=https://dummy.example.com
ENV FIRECRAWL_API_KEY=dummy
ENV OPENWEATHER_API_KEY=dummy
ENV CRON_SECRET=dummy
ENV BLOB_READ_WRITE_TOKEN=dummy
ENV SMITHERY_API_KEY=dummy
ENV COINGECKO_API_KEY=dummy
ENV QSTASH_TOKEN=dummy
ENV RESEND_API_KEY=dummy
ENV SUPERMEMORY_API_KEY=dummy
ENV ALLOW_GUEST_ACCESS=true
ENV NEXT_PUBLIC_ALLOW_GUEST_ACCESS=true

RUN pnpm build

# ---- Production ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy drizzle config + schema for migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/lib/db/schema.ts ./lib/db/schema.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# Copy migrations if they exist
COPY --from=builder /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

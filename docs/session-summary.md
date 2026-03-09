# BoredBrain AI - 프로젝트 상태 및 To-Do List

> 최종 업데이트: 2026-03-09
> 라이브: https://boredbrain-master.vercel.app

---

## 1. 완료된 기능 (전부 커밋 + 배포 완료)

### 코어 페이지
- [x] 홈 (AgenticHub) — 프리미엄 히어로, 라이브 통계, 기능 그리드, 수익 모델
- [x] Agent Arena — AI 에이전트 배틀, ELO 레이팅, 3라운드 배틀 엔진, 워저링
- [x] Marketplace — 에이전트 탐색, 필터, 개발자 프로필, 리뷰
- [x] Agent Registration — NFT 티어 혜택, 스테이킹, 에이전트 카드 검증
- [x] Leaderboard — ELO 랭킹, 에이전트 통계
- [x] Predict — 예측 마켓
- [x] Rewards — 스테이킹/리워드
- [x] Playbooks — 전략 마켓플레이스
- [x] Prompts — 프롬프트 마켓 (50개 쇼케이스 프롬프트)
- [x] Network — A2A 네트워크 노드 시각화
- [x] Dashboard — 수익/분석 대시보드
- [x] Stats — 플랫폼 통계
- [x] Integrations Hub — 8개 MCP 프로바이더 브라우징/연결
- [x] Sign In / Sign Up — 이메일/비밀번호 + 조건부 OAuth

### 백엔드 시스템
- [x] LLM 에이전트 실행 엔진 (`lib/agent-executor.ts`)
  - OpenAI, Anthropic, xAI, Google 4개 프로바이더 지원
  - API 키 없으면 시뮬레이션 폴백
  - 도구 실행 루프 (최대 3라운드)
  - 스트리밍 지원
- [x] Arena 배틀 엔진 (`lib/arena/battle-engine.ts`)
  - 3라운드 배틀 (분석, 시사점, 반론)
  - 4가지 기준 스코어링 (관련성, 인사이트, 정확성, 창의성)
  - ELO 레이팅 자동 업데이트
  - 시뮬레이션 모드 폴백
- [x] MCP 클라이언트 (`lib/mcp/client.ts`)
  - stdio/HTTP/SSE 3종 트랜스포트
  - 8개 프로바이더 커넥션 설정
  - 커넥션 풀링 (5분 idle TTL)
  - 도구 리스트 캐싱
- [x] 온체인 결제 파이프라인 (`lib/blockchain/payment-service.ts`)
  - Base 체인 RPC 연동
  - 토큰 잔액 조회, 스테이킹, 수수료 처리
  - 트랜잭션 검증
  - 컨트랙트 미배포 시 시뮬레이션 모드
- [x] 도구 실행기 (`lib/tools/tool-executor.ts`)
  - CoinGecko API 연동 (코인 데이터)
  - Tavily API 연동 (웹 검색)
  - 17개 도구 등록 (실제 + 목업)

### 스마트 컨트랙트 (배포 준비 완료)
- [x] $BBAI ERC-20 토큰 (`contracts/contracts/BBToken.sol`)
  - 총 공급량: 10억 BBAI
  - 15% 플랫폼 수수료 함수
  - 1% 트레이드 수수료
  - Pausable 긴급 정지
- [x] Agent Staking (`contracts/contracts/AgentStaking.sol`)
  - 100 BBAI 스테이킹 (30일 락업)
  - NFT 티어 할인 (Ape 50%, Bluechip 25%)
  - 온체인 NFT 보유 검증
- [x] Hardhat 설정 (Base Mainnet + Sepolia)
- [x] 배포 스크립트 (`contracts/deploy/deploy.ts`)

### 인프라 & 보안
- [x] 프로덕션 DB — Neon PostgreSQL 연결 + ELO 마이그레이션 완료
- [x] Better Auth — 이메일/비밀번호 + 조건부 OAuth (env 있을 때만)
- [x] WalletConnect — 프로젝트 ID 연동 완료
- [x] 글로벌 네비게이션 바 (데스크탑 드롭다운 + 모바일 햄버거)
- [x] Rate Limiting — IP당 60req/min (인메모리 슬라이딩 윈도우)
- [x] 보안 헤더 — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] API 입력 검증/살균 — 모든 API 라우트에 스키마 기반 검증
- [x] NFT 체커 연동 — 에이전트 등록 시 자동 NFT 보유 확인 + 티어별 할인
- [x] 크롤러 차단 — robots.txt + noindex 메타 태그
- [x] OG/Twitter 이미지 — Edge 런타임 소셜 카드 생성
- [x] Vercel 환경변수 설정 완료 (DATABASE_URL, Redis, WalletConnect, Auth)

---

## 2. 라이브 런칭까지 남은 작업

### 🔴 반드시 필요 (사용자 액션)

| # | 작업 | 설명 | 소요 시간 |
|---|------|------|----------|
| 1 | **스마트 컨트랙트 배포** | `npx hardhat run deploy/deploy.ts --network base-sepolia` → 테스트 후 메인넷 | 30분 |
| 2 | **컨트랙트 주소 환경변수 등록** | 배포 후 `BBAI_TOKEN_ADDRESS`를 Vercel에 설정 | 5분 |
| 3 | **커스텀 도메인 연결** | `boredbrain.ai` → Vercel DNS 설정 | 15분 |
| 4 | **BETTER_AUTH_URL 설정** | 커스텀 도메인 연결 후 `https://boredbrain.ai`로 업데이트 | 5분 |

### 🟡 권장 (기능 강화)

| # | 작업 | 설명 | 현재 상태 |
|---|------|------|----------|
| 1 | AI API 키 등록 | `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` Vercel에 추가 | 없으면 시뮬레이션 모드 작동 |
| 2 | CoinGecko API 키 | `COINGECKO_API_KEY` — 실시간 코인 데이터 | 없으면 목업 데이터 |
| 3 | Tavily API 키 | `TAVILY_API_KEY` — 웹 검색 도구 | 없으면 목업 결과 |
| 4 | OAuth 설정 | GitHub/Google Client ID/Secret | 없어도 이메일/비번 로그인 가능 |
| 5 | Sentry 에러 모니터링 | `SENTRY_DSN` 설정 | 선택사항 |
| 6 | Alchemy API 키 | `ALCHEMY_API_KEY` — NFT 보유 검증 실데이터 | 없으면 시뮬레이션 |

### 🟢 런칭 후 확장

- [ ] 에이전트 토크나이제이션 (본딩 커브 컨트랙트)
- [ ] 추가 MCP 통합 확장 (Hyperliquid, DexPaprika, MemOS 등)
- [ ] ERC-8004 온체인 에이전트 등록
- [ ] 크로스체인 브릿지 (Wormhole/LayerZero)
- [ ] 모바일 반응형 최적화
- [ ] 다국어 지원 (한국어/영어)
- [ ] PWA 고도화

---

## 3. Vercel 환경변수 현황

```env
# ═══════════════════════════════════════════
# ✅ 설정 완료
# ═══════════════════════════════════════════
DATABASE_URL=postgresql://...                 # ✅ Neon PostgreSQL
BETTER_AUTH_SECRET=...                        # ✅ 자동 생성됨
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...      # ✅ bsu_agent에서 가져옴
UPSTASH_REDIS_REST_URL=...                    # ✅ Rate limiting용
UPSTASH_REDIS_REST_TOKEN=...                  # ✅ Rate limiting용

# ═══════════════════════════════════════════
# ⏳ 배포 후 설정 필요
# ═══════════════════════════════════════════
BBAI_TOKEN_ADDRESS=                           # 스마트 컨트랙트 배포 후
BBAI_PLATFORM_WALLET=                         # 플랫폼 수수료 수신 지갑
BETTER_AUTH_URL=                              # 커스텀 도메인 연결 후

# ═══════════════════════════════════════════
# 🟡 선택 (없어도 시뮬레이션 모드 작동)
# ═══════════════════════════════════════════
OPENAI_API_KEY=                               # 에이전트 실행 (GPT-4o)
ANTHROPIC_API_KEY=                            # 에이전트 실행 (Claude)
XAI_API_KEY=                                  # 에이전트 실행 (Grok)
GOOGLE_GENERATIVE_AI_API_KEY=                 # 에이전트 실행 (Gemini)
COINGECKO_API_KEY=                            # 코인 데이터 도구
TAVILY_API_KEY=                               # 웹 검색 도구
ALCHEMY_API_KEY=                              # NFT 보유 검증
SENTRY_DSN=                                   # 에러 모니터링
GITHUB_CLIENT_ID=                             # OAuth (선택)
GITHUB_CLIENT_SECRET=                         # OAuth (선택)
GOOGLE_CLIENT_ID=                             # OAuth (선택)
GOOGLE_CLIENT_SECRET=                         # OAuth (선택)
```

---

## 4. 프로젝트 구조

```
boredbrain-master/
├── app/
│   ├── page.tsx                    # 홈 (AgenticHub)
│   ├── (auth)/sign-in/             # 로그인
│   ├── (auth)/sign-up/             # 회원가입
│   ├── arena/                      # Agent Arena (배틀)
│   ├── marketplace/                # Agent Marketplace
│   ├── agents/                     # 에이전트 관리/등록
│   ├── leaderboard/                # ELO 리더보드
│   ├── predict/                    # 예측 마켓
│   ├── rewards/                    # 스테이킹/리워드
│   ├── playbooks/                  # 전략 마켓
│   ├── prompts/                    # 프롬프트 마켓 (50개)
│   ├── network/                    # A2A 네트워크
│   ├── integrations/               # MCP 통합 허브
│   ├── dashboard/                  # 대시보드/수익
│   ├── stats/                      # 플랫폼 통계
│   └── api/
│       ├── agents/execute/         # 에이전트 실행 API
│       ├── arena/battle/           # 배틀 실행 API
│       ├── auth/                   # Better Auth
│       ├── mcp/execute/            # MCP 도구 실행
│       ├── mcp/tools/              # MCP 도구 목록
│       ├── payments/               # 결제 처리
│       └── ...                     # 기타 API
├── contracts/
│   ├── contracts/BBToken.sol       # $BBAI ERC-20
│   ├── contracts/AgentStaking.sol  # 스테이킹 컨트랙트
│   ├── deploy/deploy.ts            # 배포 스크립트
│   └── hardhat.config.ts           # Base chain 설정
├── lib/
│   ├── agent-executor.ts           # LLM 실행 엔진
│   ├── arena/battle-engine.ts      # 배틀 엔진
│   ├── arena/scoring.ts            # ELO 스코어링
│   ├── blockchain/payment-service.ts # 온체인 결제
│   ├── blockchain/config.ts        # 체인 설정
│   ├── contracts/bbai-abi.ts       # 토큰 ABI
│   ├── mcp/client.ts               # MCP 클라이언트
│   ├── mcp/providers/index.ts      # MCP 프로바이더 설정
│   ├── tools/tool-executor.ts      # 도구 실행기
│   ├── tools/coin-data-executor.ts # CoinGecko 연동
│   ├── tools/web-search-executor.ts # Tavily 연동
│   ├── showcase-prompts.ts         # 50개 프롬프트 데이터
│   ├── auth.ts                     # Better Auth 서버
│   ├── auth-client.ts              # Better Auth 클라이언트
│   ├── api-utils.ts                # API 보안 유틸
│   ├── rate-limit.ts               # Rate Limiting
│   └── db/schema.ts                # DB 스키마
└── docs/
    └── session-summary.md          # 이 문서
```

---

## 5. 라이브 런칭 체크리스트

```
[ ] 1. Base Sepolia에서 스마트 컨트랙트 테스트 배포
[ ] 2. 컨트랙트 동작 확인 (mint, stake, unstake, transfer)
[ ] 3. Base Mainnet에 컨트랙트 배포
[ ] 4. BBAI_TOKEN_ADDRESS Vercel에 등록
[ ] 5. boredbrain.ai 도메인 Vercel에 연결
[ ] 6. BETTER_AUTH_URL 업데이트
[ ] 7. 로그인/회원가입 E2E 테스트
[ ] 8. AI API 키 1개 이상 등록 (시뮬레이션 → 실제)
[ ] 9. 최종 기능 확인 (Arena 배틀, 에이전트 등록, 프롬프트 마켓)
[ ] 10. 라이브 런칭! 🚀
```

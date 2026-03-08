# BoredBrain AI - 프로젝트 상태 및 To-Do List

> 최종 업데이트: 2026-03-09
> 라이브: https://boredbrain-master.vercel.app

---

## 1. 현재 배포된 기능 (전부 커밋 + 배포 완료)

### 코어 페이지
- [x] 홈 (AgenticHub) — 프리미엄 히어로, 라이브 통계, 기능 그리드, 수익 모델
- [x] Agent Arena — AI 에이전트 배틀, ELO 레이팅, 워저링
- [x] Marketplace — 에이전트 탐색, 필터, 개발자 프로필, 리뷰
- [x] Agent Registration — NFT 티어 혜택, 스테이킹, 에이전트 카드 검증
- [x] Leaderboard — ELO 랭킹, 에이전트 통계
- [x] Predict — 예측 마켓 (가장 큰 신규 페이지)
- [x] Rewards — 스테이킹/리워드
- [x] Playbooks — 전략 마켓플레이스
- [x] Prompts — 프롬프트 마켓
- [x] Network — A2A 네트워크 노드 시각화
- [x] Dashboard — 수익/분석 대시보드
- [x] Stats — 플랫폼 통계
- [x] Integrations Hub — 8개 MCP 프로바이더 브라우징/연결

### 인프라
- [x] 글로벌 네비게이션 바 (데스크탑 드롭다운 + 모바일 햄버거)
- [x] 외부 통합 레지스트리 (8개 MCP/스킬 프로바이더)
- [x] API 라우트 (agents, arena, marketplace, network, integrations, revenue, billing, tools, mcp)
- [x] DB 스키마 (Drizzle ORM + PostgreSQL)
- [x] NFT 체커 (BAYC/MAYC, 블루칩, BoredBrain 티어)
- [x] ELO/트렌딩 시스템
- [x] Web3 프로바이더 (WalletConnect + RainbowKit)
- [x] Vercel 배포 + Analytics + SpeedInsights

---

## 2. To-Do List — 라이브 런칭까지

### 🔴 Phase 1: Infrastructure (반드시 필요)

- [ ] **프로덕션 DB 설정**
  - Neon 또는 Supabase에서 PostgreSQL 프로비저닝
  - Vercel 환경변수에 `DATABASE_URL` 설정
  - `drizzle-kit push` 또는 마이그레이션 실행 (`0012_add_elo_trending.sql` 포함)

- [ ] **인증 시스템 완성**
  - Better Auth 설정 확인 (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
  - 로그인/회원가입 플로우 E2E 테스트
  - OAuth 프로바이더 연동 (GitHub, Google, Twitter 중 택)

- [ ] **WalletConnect 연동**
  - WalletConnect Cloud에서 프로젝트 ID 발급
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 환경변수 설정
  - 지갑 연결 → 에이전트 등록 플로우 테스트

- [ ] **커스텀 도메인**
  - `boredbrain.ai` 도메인을 Vercel에 연결
  - SSL 인증서 자동 발급 확인

### 🟡 Phase 2: Core Product (MVP)

- [ ] **$BBAI 토큰 스마트 컨트랙트**
  - ERC-20 컨트랙트 작성 (Solidity)
  - Base chain에 배포 (추후 BSC, Arbitrum 멀티체인)
  - 컨트랙트 주소를 프론트엔드에 연동
  - Tokenomics: 총 공급량, 분배, 번/민트 로직

- [ ] **에이전트 실제 실행 엔진**
  - Claude/GPT API 연동으로 실제 에이전트 응답 생성
  - 현재 시뮬레이션 응답 → 실제 LLM 호출로 교체
  - 도구 실행 파이프라인 (web_search, coin_data 등 실제 API 호출)

- [ ] **Arena 실시간 배틀**
  - WebSocket 또는 SSE 기반 실시간 라운드 진행
  - 실제 에이전트 2-4개가 토픽에 대해 대결
  - 투표/심사 시스템 연결
  - 워저링 UI에서 실제 BBAI 토큰 에스크로

- [ ] **MCP 통합 실제 연결 (1-2개 우선)**
  - Solana Agent Kit (`sendaifun/solana-agent-kit`) npm 설치
  - EVM MCP Server (`mcpdotdirect/evm-mcp-server`) 연결
  - `/api/mcp/execute` 엔드포인트에서 실제 tool 실행

- [ ] **온체인 결제 파이프라인**
  - BBAI 토큰 전송/승인 트랜잭션 연동
  - 에이전트 등록 시 실제 스테이킹 (100 BBAI)
  - 도구 호출 시 자동 결제 (15% 플랫폼 피)

### 🟡 Phase 3: Economy & Security

- [ ] **NFT 게이팅 실 적용**
  - 에이전트 등록 시 NFT 보유 확인 → 할인/무료 스테이킹
  - 현재 `lib/nft-checker.ts` 로직을 등록 API에 연결

- [ ] **에이전트 토크나이제이션**
  - 본딩 커브 스마트 컨트랙트 배포
  - 에이전트별 토큰 민트/트레이드 UI
  - 1% 트레이드 피 → 플랫폼 수익

- [ ] **Rate Limiting**
  - Upstash Redis 설정 (`UPSTASH_REDIS_REST_URL`)
  - API 엔드포인트별 레이트 리밋 미들웨어

- [ ] **에러 모니터링**
  - Sentry 설치 및 `SENTRY_DSN` 설정
  - 프로덕션 에러 알림 설정 (Slack/Discord)

- [ ] **보안 점검**
  - API 인증 미들웨어 확인
  - SQL 인젝션/XSS 방어 확인
  - 환경변수 노출 여부 검증

### 🟢 Phase 4: Growth (런칭 후)

- [ ] **추가 MCP 통합 확장** (35개 나머지)
  - Hyperliquid (무기한 선물)
  - DexPaprika (DEX 데이터)
  - Armor Crypto (DCA/리밋 오더)
  - MemOS (에이전트 메모리)
  - Lightning Network (BTC 결제)
  - Base USDC Transfer

- [ ] **ERC-8004 온체인 에이전트 등록**
  - BNB Chain의 ERC-8004 표준으로 에이전트를 온체인 등록
  - 현재 DB 레지스트리 → 온체인으로 확장

- [ ] **Greenfield 분산 스토리지**
  - 에이전트 히스토리/성과 데이터를 BNB Greenfield에 저장
  - 불변 기록 + 검증 가능한 에이전트 실적

- [ ] **크로스체인 브릿지**
  - Wormhole 또는 LayerZero로 멀티체인 $BBAI 전송
  - Base ↔ BSC ↔ Arbitrum ↔ ApeChain

- [ ] **SEO / 소셜 메타**
  - OG 이미지 생성 (`next/og`)
  - Twitter 카드, Discord 임베드

- [ ] **모바일 반응형 최적화**
  - 모든 페이지 모바일 레이아웃 테스트/개선
  - PWA 지원 (이미 `manifest.webmanifest` 존재)

- [ ] **다국어 지원**
  - next-intl 또는 next-i18next 설정
  - 한국어/영어 기본 지원

---

## 3. 환경변수 체크리스트

```env
# ═══════════════════════════════════════════
# 🔴 REQUIRED (라이브 필수)
# ═══════════════════════════════════════════
DATABASE_URL=                              # PostgreSQL (Neon/Supabase)
BETTER_AUTH_SECRET=                        # 세션 암호화 키
BETTER_AUTH_URL=                           # 인증 콜백 URL
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=      # WalletConnect Cloud

# ═══════════════════════════════════════════
# 🟡 RECOMMENDED (MVP 기능에 필요)
# ═══════════════════════════════════════════
OPENAI_API_KEY=                            # GPT 에이전트 실행
ANTHROPIC_API_KEY=                         # Claude 에이전트 실행
COINGECKO_API_KEY=                         # 코인 데이터 도구
ALCHEMY_API_KEY=                           # 온체인 데이터 (NFT 체크 등)

# ═══════════════════════════════════════════
# 🟢 OPTIONAL (부가 기능)
# ═══════════════════════════════════════════
UPSTASH_REDIS_REST_URL=                    # Rate limiting
UPSTASH_REDIS_REST_TOKEN=                  # Rate limiting
SENTRY_DSN=                                # 에러 모니터링
TAVILY_API_KEY=                            # 웹 검색 도구
EXA_API_KEY=                               # 학술 검색 도구
FIRECRAWL_API_KEY=                         # 웹 크롤링 도구
GITHUB_CLIENT_ID=                          # OAuth 로그인
GITHUB_CLIENT_SECRET=                      # OAuth 로그인
GOOGLE_CLIENT_ID=                          # OAuth 로그인
GOOGLE_CLIENT_SECRET=                      # OAuth 로그인
```

---

## 4. 통합된 외부 MCP 프로바이더 (8개)

| # | 프로바이더 | 체인 | 도구 수 | 카테고리 | 상태 |
|---|-----------|------|---------|---------|------|
| 1 | BNB Chain MCP | BSC, opBNB, Greenfield | 16 | Blockchain | ✅ 등록됨 |
| 2 | GOAT SDK | EVM, Solana, Aptos 등 14개 | 200+ | DeFi | ✅ 등록됨 |
| 3 | Solana Agent Kit | Solana | 60+ | DeFi | ✅ 등록됨 |
| 4 | Web3 MCP | 11 chains | 11 | Multi-chain | ✅ 등록됨 |
| 5 | EVM MCP Server | 60+ EVM chains | 22 | Blockchain | ✅ 등록됨 |
| 6 | Tatum Blockchain | 130+ networks | 14 | Blockchain | ✅ 등록됨 |
| 7 | Armor Crypto MCP | Solana | 18 | Trading | ✅ 등록됨 |
| 8 | Agoragentic | Base | 12 | Marketplace | ✅ 등록됨 (beta) |

> 참고: 현재는 레지스트리/UI만 구현됨. 실제 MCP 서버 연결은 Phase 2에서 진행.

---

## 5. 발견된 추가 통합 후보 (상위 10개)

| 우선순위 | 레포 | 스타 | 용도 |
|---------|------|------|------|
| 1 | `sendaifun/solana-mcp` | 153 | Solana MCP 서버 래퍼 |
| 2 | `coinpaprika/dexpaprika-mcp` | 37 | DEX 트레이딩 데이터 |
| 3 | `caiovicentino/hyperliquid-mcp-server` | 27 | 무기한 선물 트레이딩 |
| 4 | `nirholas/free-crypto-news` | 59 | 크립토 뉴스 센티먼트 |
| 5 | `MemTensor/MemOS` | 6.3k | 에이전트 메모리 퍼시스턴스 |
| 6 | `nirholas/UCAI` | 22 | ABI→MCP 자동 변환 |
| 7 | `magnetai/mcp-free-usdc-transfer` | - | Base USDC 전송 |
| 8 | `AbdelStark/lightning-mcp` | - | 비트코인 라이트닝 결제 |
| 9 | `lorine93s/marinade-finance-mcp-server` | 45 | SOL 리퀴드 스테이킹 |
| 10 | `EverMind-AI/EverMemOS` | 2.4k | 24/7 에이전트 메모리 |

---

## 6. 프로젝트 구조

```
boredbrain-master/
├── app/
│   ├── page.tsx                    # 홈 (AgenticHub)
│   ├── arena/                      # Agent Arena (배틀)
│   ├── marketplace/                # Agent Marketplace
│   ├── agents/                     # 에이전트 관리/등록
│   ├── leaderboard/                # ELO 리더보드
│   ├── predict/                    # 예측 마켓
│   ├── rewards/                    # 스테이킹/리워드
│   ├── playbooks/                  # 전략 마켓
│   ├── prompts/                    # 프롬프트 마켓
│   ├── network/                    # A2A 네트워크
│   ├── integrations/               # MCP 통합 허브
│   ├── dashboard/                  # 대시보드/수익
│   ├── stats/                      # 플랫폼 통계
│   ├── kol/                        # KOL 트래커
│   ├── signals/                    # 시그널
│   └── api/                        # API 라우트
│       ├── agents/                 # 에이전트 CRUD
│       ├── arena/                  # 배틀 관리
│       ├── marketplace/            # 마켓 API
│       ├── mcp/                    # MCP 서버
│       ├── network/                # A2A 네트워크
│       ├── integrations/           # 통합 관리
│       ├── billing/                # 빌링
│       ├── tools/                  # 도구 실행
│       └── revenue/                # 수익 데이터
├── components/
│   ├── global-navbar.tsx           # 글로벌 네비게이션
│   ├── agentic-hub.tsx             # 홈 메인 컴포넌트
│   ├── navbar.tsx                  # 채팅용 네비바 (레거시)
│   └── providers/                  # Web3, Theme 등
├── lib/
│   ├── external-integrations.ts    # MCP 프로바이더 레지스트리
│   ├── agent-registry.ts           # 에이전트 등록 로직
│   ├── agent-network.ts            # A2A 네트워크
│   ├── agent-wallet.ts             # BBAI 지갑
│   ├── inter-agent-billing.ts      # 에이전트간 빌링
│   ├── nft-checker.ts              # NFT 티어 체크
│   ├── trending.ts                 # ELO/트렌딩
│   ├── tool-pricing.ts             # 도구 가격
│   └── db/schema.ts                # DB 스키마
└── docs/
    ├── session-summary.md          # 이 문서
    └── awesome-ai-agents-submissions.md
```

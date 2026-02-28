2# 🔍 BoredBrain 프로젝트 종합 분석 보고서

> 분석일: 2026-01-20

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [디렉토리 구조](#디렉토리-구조)
4. [문제점 분석](#문제점-분석)
5. [업그레이드 방안](#업그레이드-방안)
6. [요약](#요약)

---

## 프로젝트 개요

**BoredBrain**은 **AI 기반 메타 서치 코파일럿**으로, LLM 추론과 실시간 웹/미디어/금융/위치 데이터를 결합한 멀티채널 AI 검색 플랫폼입니다.

### 핵심 기능

- AI 기반 인터넷 검색 엔진 (멀티턴 대화식)
- 실시간 데이터 통합 (웹, 소셜미디어, 금융, 암호화폐, 지리정보)
- 브라우저 및 Telegram Mini App 양쪽 지원
- 자동화된 스케줄된 검색 (Signals) 기능
- 장기 메모리 및 임베딩 저장소 (Supermemory) 통합

### 프로젝트 규모

| 항목 | 수치 |
|------|------|
| 컴포넌트 파일 | 111개 |
| 유틸리티/라이브러리 | 53개 |
| AI 도구 | 27개 |
| API 라우트 | 10개 |
| 데이터베이스 테이블 | 14개 |
| 마이그레이션 | 10개 |
| 의존성 | 145개 |
| 개발 의존성 | 24개 |

---

## 기술 스택

### 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.1.1 | UI 라이브러리 |
| Next.js | 15.6.0-canary.25 | 풀스택 프레임워크 (App Router) |
| TypeScript | 5.x | 타입 안정성 |
| Tailwind CSS | 4.1.13 | 스타일링 |
| Shadcn/UI | - | UI 컴포넌트 라이브러리 |
| Radix UI | - | 접근성 있는 UI 원시(primitives) |
| TanStack React Query | 5.90.2 | 데이터 페칭 및 캐싱 |
| Framer Motion | 12.23.21 | 애니메이션 |

### 백엔드 및 AI

| 기술 | 버전/설명 | 용도 |
|------|----------|------|
| Vercel AI SDK | 5.0.51 | AI 모델 통합 및 스트리밍 |
| xAI (Grok) | @ai-sdk/xai 2.0.22 | 주요 LLM 모델 |
| Google Gemini | @ai-sdk/google 2.0.16 | 보조 LLM 모델 |
| Anthropic Claude | @ai-sdk/anthropic 2.0.18 | AI 모델 |
| Groq | @ai-sdk/groq 2.0.21 | 빠른 추론 |
| OpenAI | @ai-sdk/openai 2.0.34 | AI 모델 |
| ElevenLabs | @ai-sdk/elevenlabs 1.0.11 | 음성 합성 |

### 데이터베이스 및 인프라

| 기술 | 설명 |
|------|------|
| PostgreSQL | 메인 데이터베이스 (Neon/Supabase 지원) |
| Drizzle ORM | 타입 안전 ORM |
| Upstash Redis | 캐싱 및 세션 저장 |
| Upstash QStash | 백그라운드 작업 및 스케줄 |
| Vercel Blob | 파일 업로드 스토리지 |

### 검색 및 데이터 통합

| 도구 | 설명 |
|------|------|
| Firecrawl | 웹 크롤링 및 콘텐츠 추출 |
| Exa | 의미론적 검색 |
| Tavily | 웹 검색 |
| YouTube Caption Extractor | 유튜브 자막 추출 |
| TMDB API | 영화/TV 데이터 |
| CoinGecko | 암호화폐 데이터 |
| OpenWeather | 날씨 데이터 |
| Google Maps/Leaflet | 지도 및 위치 |
| Amadeus | 항공편 데이터 |

### 인증 및 결제

| 기술 | 설명 |
|------|------|
| Better Auth | 다중 OAuth (GitHub, Google, Twitter, Telegram) |
| Telegram Bot | Telegram Mini App 통합 |
| Polar | 구독 관리 |
| DodoPayments | 결제 처리 |

---

## 디렉토리 구조

```
boredbrain-master/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 관련 페이지
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (search)/                 # 메인 검색 페이지
│   ├── api/                      # API 라우트
│   │   ├── search/route.ts       # 핵심 검색 엔진
│   │   ├── auth/[...all]/        # Better Auth 통합
│   │   ├── transcribe/           # 음성 변환 (ElevenLabs)
│   │   ├── upload/               # 파일 업로드 (Vercel Blob)
│   │   ├── signals/              # 자동화 신호 API
│   │   ├── kol/                  # Key Opinion Leader API
│   │   └── raycast/              # Raycast 확장 API
│   ├── signals/                  # 자동화 스케줄 UI
│   ├── search/[id]/              # 검색 결과 페이지
│   ├── telegram/                 # Telegram Mini App
│   ├── actions.ts                # 서버 액션
│   └── layout.tsx                # 루트 레이아웃
│
├── components/                   # React 컴포넌트 (111개 파일)
│   ├── ui/                       # Shadcn UI 컴포넌트
│   ├── core/                     # 핵심 컴포넌트
│   ├── dialogs/                  # 다이얼로그
│   ├── emails/                   # 이메일 템플릿 (React Email)
│   ├── message-parts/            # 메시지 렌더링 컴포넌트
│   ├── share/                    # 공유 기능 컴포넌트
│   ├── chat-interface.tsx        # 메인 채팅 UI
│   └── data-stream-provider.tsx  # 스트리밍 데이터 공급자
│
├── contexts/                     # React Context
│   └── user-context.tsx          # 사용자 데이터 컨텍스트
│
├── hooks/                        # 커스텀 React 훅 (13개)
│   ├── use-cached-user-data.tsx
│   ├── use-signals.ts
│   ├── use-telegram.ts
│   └── use-user-data.ts
│
├── lib/                          # 유틸리티 및 핵심 로직 (53개 파일)
│   ├── db/
│   │   ├── schema.ts             # Drizzle ORM 스키마
│   │   ├── queries.ts            # 데이터베이스 쿼리
│   │   └── index.ts              # DB 연결
│   ├── tools/                    # AI 도구 (27개)
│   │   ├── web-search.ts
│   │   ├── extreme-search.ts
│   │   ├── x-search.ts
│   │   ├── youtube-search.ts
│   │   ├── academic-search.ts
│   │   ├── crypto-tools.ts
│   │   ├── stock-chart.ts
│   │   ├── map-tools.ts
│   │   └── ...
│   ├── auth.ts                   # Better Auth 설정
│   ├── auth-client.ts            # 클라이언트 인증
│   └── secure-telegram-plugin.ts # Telegram 보안
│
├── ai/
│   └── providers.ts              # AI 모델 설정
│
├── env/
│   ├── server.ts                 # 서버 환경 변수
│   └── client.ts                 # 클라이언트 환경 변수
│
├── drizzle/
│   └── migrations/               # DB 마이그레이션 (10개)
│
├── middleware.ts                 # Next.js 미들웨어 (인증)
├── next.config.ts                # Next.js 설정
└── package.json                  # 의존성
```

---

## 문제점 분석

### 1. 보안 취약점 (Critical) 🔴

#### 1.1 민감 정보 로깅 노출

**파일:** `middleware.ts:20`
```typescript
// 모든 헤더가 로그에 노출됨
console.log('🔍 Telegram Detection Debug:', {
  allHeaders: Object.fromEntries(request.headers.entries()),
});
```

**위험:** Authorization 헤더, 쿠키 등 민감 정보가 로그에 노출될 수 있음

---

**파일:** `lib/auth.ts:48-52`
```typescript
console.log('[auth] Telegram bot token status:', {
  tokenPreview: TELEGRAM_BOT_TOKEN?.substring(0, 10) + '...',
});
```

**위험:** 토큰 일부가 로그에 노출됨

---

#### 1.2 세션 캐시 만료 검증 부재

**파일:** `lib/auth-utils.ts:17-22`
```typescript
const cached = sessionCache.get(cacheKey);
if (cached) {
  return cached;  // 만료 여부 확인 없이 반환
}
```

**위험:** 만료된 세션이 캐시에서 그대로 반환될 수 있음

---

#### 1.3 하드코딩된 ngrok URL

**파일:** `lib/auth.ts:126`
```typescript
trustedOrigins: [
  // ...
  .concat(['https://3b58286486e2.ngrok-free.app'])  // 프로덕션에서도 실행됨
]
```

**위험:** 프로덕션 빌드에서도 하드코딩된 URL이 신뢰됨

---

#### 1.4 파일 업로드 검증 미흡

**파일:** `app/api/upload/route.ts:55`
```typescript
const blob = await put(`mplx/${prefix}.${file.name.split('.').pop()}`, file, {
  access: 'public',
});
```

**위험:** 파일명에 대한 경로 트래버설 검증 부족 (예: `../../../etc/passwd`)

---

#### 1.5 이미지 설정 보안 취약점

**파일:** `next.config.ts` - images 설정
```typescript
images: {
  remotePatterns: [
    { hostname: '**' },  // 모든 호스트 허용
  ],
  dangerouslyAllowSVG: true,  // SVG XSS 공격 가능
  // http 프로토콜도 허용됨
}
```

**위험:**
- `**` 와일드카드로 모든 원격 이미지 허용 → SSRF 공격면 확대
- `dangerouslyAllowSVG` → SVG를 통한 XSS 공격 가능
- HTTP 허용 → MITM 공격 가능

---

#### 1.6 공개 API 인증/레이트리밋 부재

**파일:** `app/api/raycast/route.ts`, `app/api/transcribe/route.ts`, `app/api/upload/route.ts`
```typescript
// 인증 체크 없이 공개적으로 접근 가능
// 레이트리밋 없음 → 악용 위험
export async function POST(request: Request) {
  // 바로 처리 시작...
}
```

**위험:**
- 프로덕션 환경에서 무인증 접근 가능
- 레이트리밋 없어 API 악용 및 비용 폭증 가능

---

#### 1.7 사용자 메시지/응답 로깅 (PII 유출)

**파일:** `app/api/search/route.ts`, `app/api/transcribe/route.ts`
```typescript
console.log('User message:', messages);
console.log('AI response:', response);
console.log('Transcription result:', transcription);
```

**위험:**
- 사용자의 개인 정보(PII)가 로그에 기록됨
- 로그 집계 시스템에서 민감 정보 노출 가능

---

#### 1.8 코드 인터프리터 실행 로깅

**파일:** `lib/tools/code-interpreter.ts`
```typescript
console.log('Executing code:', code);
console.log('Execution result:', result);
```

**위험:** 사용자가 실행한 코드와 결과가 로그에 기록됨

---

### 2. 코드 품질 문제점 🟠

#### 2.1 타입 안전성 부족

**파일:** `lib/secure-telegram-plugin.ts:176`
```typescript
let userObj: Record<string, any> = {};  // any 타입 사용
```

**파일:** `app/api/search/route.ts:95`
```typescript
async function getCachedCustomInstructions(user: any)  // 타입 미지정
```

**영향:**
- 런타임 에러 가능성 증가
- IDE 자동완성 제한
- 리팩토링 시 버그 위험

---

#### 2.2 에러 처리 미흡

**파일:** `lib/secure-telegram-plugin.ts:272`
```typescript
} catch {}  // 에러를 완전히 무시함
```

**파일:** `lib/db/queries.ts:14`
```typescript
catch (error) {
  throw new ChatSDKError('bad_request:database', 'Failed to get user');
  // 원본 에러 정보가 손실됨
}
```

---

#### 2.3 중복 코드

**파일:** `middleware.ts:8` vs `middleware.ts:109`
```typescript
// 동일한 로직이 2번 반복됨
const allowGuestAccess =
  (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';
// ... (109줄에서 반복)
const guestAccessEnabled =
  (process.env.NEXT_PUBLIC_ALLOW_GUEST_ACCESS ?? process.env.ALLOW_GUEST_ACCESS ?? 'false') !== 'false';
```

**파일:** `app/page.tsx` vs `middleware.ts`
```typescript
// isTelegram 함수가 중복 정의됨
```

---

#### 2.4 매직 넘버

**파일:** `lib/secure-telegram-plugin.ts:10`
```typescript
const TELEGRAM_AUTH_DATE_TTL_SECONDS = 5 * 60;  // 매직넘버
```

**파일:** `app/api/search/route.ts:296`
```typescript
const dailyLimit = 100;  // 상수 처리 안 됨
```

**파일:** `lib/db/index.ts:12`
```typescript
ex: 600  // 하드코딩된 캐시 TTL
```

---

### 3. 신뢰성/데이터 무결성 문제 🟠

#### 3.1 전역 캐시 메모리 누적

**파일:** `app/api/search/route.ts`
```typescript
// 모듈 전역으로 유지됨 - 요청 간 누적
const dbOperationTimings: Map<string, number> = new Map();
const customInstructionsCache = new Map<string, { data: any; timestamp: number }>();
```

**위험:**
- 서버리스 환경에서 요청 간 메모리 누적
- TTL/LRU 정책 없이 무한 증가 가능
- 메모리 누수로 인한 서비스 불안정

---

#### 3.2 메시지 저장 정합성 문제

**파일:** `app/api/search/route.ts`
```typescript
// 1. 사용자 메시지 먼저 저장
await saveMessages({ messages: [userMessage] });

// 2. onFinish에서 전체 메시지 다시 저장
onFinish: async ({ response }) => {
  await saveMessages({ messages: response.messages });
}
```

**파일:** `lib/db/queries.ts`
```typescript
// saveMessages가 upsert가 아닌 insert만 수행
// → 중복 저장 시 PK 충돌 가능
```

**위험:** 메시지 중복 저장 또는 PK 충돌로 인한 데이터 손실

---

#### 3.3 입력 스키마 검증 부재

**파일:** `app/api/search/route.ts`
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const { messages, model, group, id } = body;
  // Zod 스키마 검증 없음
  // messages가 빈 배열이거나 id가 누락되면 런타임 오류
}
```

**위험:**
- 잘못된 입력으로 런타임 크래시
- 예상치 못한 데이터 타입으로 보안 문제 발생 가능

---

#### 3.4 코드 인터프리터 리소스 누수

**파일:** `lib/tools/code-interpreter.ts`
```typescript
try {
  const sandbox = await createSandbox();
  const result = await sandbox.execute(code);
  await sandbox.delete();  // try 블록 안에서만 실행
  return result;
} catch (error) {
  // sandbox.delete() 호출 안 됨 → 리소스 누수
  throw error;
}
```

**해결:** `finally` 블록에서 `sandbox.delete()` 실행 필요

---

#### 3.5 중복 DB/세션 조회

**파일:** `app/actions.ts`
```typescript
export async function getGroupConfig(groupId: string) {
  const user = await getCurrentUser();  // 이미 호출된 곳에서 다시 호출
  // ...
}
```

**위험:** 불필요한 DB/세션 조회로 응답 지연 및 부하 증가

---

#### 3.6 Resumable Stream 비활성화

**파일:** `app/api/search/route.ts`
```typescript
// resumable stream 경로가 주석 처리됨
// const streamPath = getResumableStreamPath(id);
// → 스트리밍 복구 로직이 사실상 비활성화
```

**위험:** 네트워크 중단 시 스트리밍 복구 불가

---

### 4. 성능 문제 🟡

#### 4.1 N+1 쿼리 문제

**파일:** `app/api/search/route.ts:206-212`
```typescript
// 순차적으로 실행됨 (비효율적)
const existingChat = await getChatById({ id });
if (!existingChat) {
  await saveChat({ ... });  // 별도 쿼리
}
await createStreamId({ streamId, chatId: id });  // 또 다른 쿼리
```

**해결:** `Promise.all()` 병렬 처리 적용 필요

---

#### 3.2 메모이제이션 부족

**파일:** `components/chat-interface.tsx`
```typescript
// useCallback 미사용 - 모든 렌더링마다 새로운 함수 생성
const handleOpenSettings = (tab?: string) => {
  // ...
};
```

---

#### 3.3 번들 사이즈

- 145개 의존성으로 번들 크기 비대
- 여러 AI SDK 동시 포함 (Anthropic, Google, OpenAI, Groq 등)
- 사용하지 않는 의존성도 번들에 포함

---

### 4. 아키텍처 문제 🟡

#### 4.1 관심사 분리 부족

**파일:** `app/api/search/route.ts`
```
POST 핸들러가 500줄 이상으로 비대:
├── 인증 체크
├── 데이터 캐싱
├── 로깅
├── 데이터베이스 쿼리
├── 검증 로직
└── 모두 한 함수에 혼재
```

---

#### 4.2 테스트 용이성 낮음

**파일:** `lib/auth.ts:54-144`
```typescript
// auth 객체가 전역으로 초기화됨
// 테스트에서 mock하기 어려움
export const auth = betterAuth({ ... });
```

---

#### 4.3 상태 관리 혼재

**파일:** `components/chat-interface.tsx`
```typescript
// 로컬 상태, localStorage, Context 모두 혼용
const [input, setInput] = useState<string>('');
const [selectedModel, setSelectedModel] = useLocalStorage(...);
// 명확한 상태 관리 전략 부재
```

---

### 5. 운영/유지보수 문제 🟠

#### 5.1 불안정한 의존성 버전

**파일:** `package.json`
```json
{
  "dependencies": {
    "next": "15.6.0-canary.25",      // canary 버전 (불안정)
    "react": "19.1.1",               // 최신 버전 (호환성 미확인)
    "better-auth": "https://pkg.pr.new/better-auth/better-auth@8e825ad"
    // PR 빌드 직접 참조 → 재현성/안정성 리스크
  }
}
```

**위험:**
- canary 버전은 프로덕션 환경에서 예상치 못한 버그 발생 가능
- `pkg.pr.new` 의존성은 언제든 사라질 수 있음
- CI/CD에서 빌드 재현성 보장 불가

---

#### 5.2 환경 변수 필수 요구

**파일:** `env/server.ts`
```typescript
// 대부분의 API 키를 필수로 요구
export const env = createEnv({
  server: {
    XAI_API_KEY: z.string(),           // 필수
    OPENAI_API_KEY: z.string(),        // 필수
    ANTHROPIC_API_KEY: z.string(),     // 필수
    // ... 20개 이상의 필수 환경 변수
  }
});
```

**위험:**
- 로컬 개발 진입 장벽 높음
- CI 테스트 환경 설정 복잡
- 모든 키 없이는 앱 시작 불가

---

#### 5.3 프롬프트 하드코딩

**파일:** `lib/assistant-groups.ts`
```typescript
const SYSTEM_PROMPT = `
You are an advanced AI search assistant...
// 500줄 이상의 대규모 프롬프트가 코드에 직접 포함
// 변경/검수/A/B 테스트 매우 어려움
`;
```

**위험:**
- 프롬프트 수정 시 코드 배포 필요
- 버전 관리 및 롤백 어려움
- 비개발자가 프롬프트 수정 불가

---

#### 5.4 테스트 부재

**현재 상태:**
```
테스트 파일: secure-telegram-plugin.test.ts (1개뿐)
```

**위험:**
- 회귀 버그 감지 불가
- 리팩토링 시 안정성 보장 없음
- API, 스트리밍, 도구 호출 등 핵심 기능 테스트 없음

---

### 6. UX/접근성 문제 🟢

#### 5.1 접근성(a11y) 미흡

**파일:** `components/markdown.tsx:100-120`
```typescript
<button
  onClick={toggleWrap}
  // aria-label 없음
  title={isWrapped ? 'Disable wrap' : 'Enable wrap'}
>
```

**파일:** `components/interactive-maps.tsx:167`
```typescript
// innerHTML 직접 조작 - 접근성 미제공
zoomInBtn.innerHTML = '+';
zoomOutBtn.innerHTML = '&minus;';
```

---

#### 5.2 에러 메시지 품질

**파일:** `lib/errors.ts:68`
```typescript
case 'database':
  return 'An error occurred while executing a database query.';
  // 너무 기술적 - 사용자 친화적이지 않음
```

---

## 업그레이드 방안

### P0 - 즉시 해결 필요 (1-2주) 🔴

#### 로그 정리
| 작업 | 파일 |
|------|------|
| `console.log` 제거 및 logger 통일 | 전체 |
| 헤더/메시지/전사 로그 비활성화 | `middleware.ts`, `app/api/search/route.ts` |
| 토큰 미리보기 제거 | `lib/auth.ts:48-52` |
| 코드 실행 로그 제거 | `lib/tools/code-interpreter.ts` |

#### 이미지 보안 강화
```typescript
// next.config.ts 수정
images: {
  remotePatterns: [
    { hostname: 'www.google.com', pathname: '/s2/favicons/**' },
    { hostname: 'image.tmdb.org' },
    { hostname: 'upload.wikimedia.org' },
    // 명시적 호스트만 허용
  ],
  dangerouslyAllowSVG: false,  // 또는 whitelist로 제한
  // http 프로토콜 차단
}
```

#### 공개 API 보호
```typescript
// app/api/raycast/route.ts, transcribe/route.ts, upload/route.ts
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth } from '@/lib/auth-utils';

export async function POST(request: Request) {
  // 환경 플래그로 공개 여부 결정
  if (process.env.REQUIRE_AUTH === 'true') {
    await validateAuth(request);
  }
  await rateLimit(request);
  // ...
}
```

#### 입력 검증 도입
```typescript
// app/api/search/route.ts
import { z } from 'zod';

const SearchInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(100000),  // 크기 제한
  })).min(1),
  model: z.string(),
  group: z.string(),
  id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const body = SearchInputSchema.parse(await request.json());
  // ...
}
```

#### 코드 인터프리터 정리 보장
```typescript
// lib/tools/code-interpreter.ts
let sandbox: Sandbox | null = null;
try {
  sandbox = await createSandbox();
  const result = await Promise.race([
    sandbox.execute(code),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 30000)
    ),
  ]);
  return result;
} finally {
  if (sandbox) await sandbox.delete();  // 항상 실행
}
```

---

### P1 - 3-6주 내 해결 🟠

#### 메시지 저장 정합성 개선
```typescript
// lib/db/queries.ts - upsert 적용
export async function saveMessages({ messages }: { messages: Message[] }) {
  await db
    .insert(message)
    .values(messages)
    .onConflictDoUpdate({
      target: message.id,
      set: { content: sql`excluded.content`, updatedAt: new Date() },
    });
}
```

#### 요청 스코프 캐시 정리
```typescript
// lib/request-cache.ts - LRU 캐시 적용
import { LRUCache } from 'lru-cache';

export const customInstructionsCache = new LRUCache<string, CacheEntry>({
  max: 1000,           // 최대 항목 수
  ttl: 5 * 60 * 1000,  // 5분 TTL
});
```

#### 중복 조회 제거
```typescript
// app/actions.ts 수정
export async function getGroupConfig(groupId: string, user?: User) {
  const currentUser = user ?? await getCurrentUser();  // user 전달 시 재조회 안 함
  // ...
}
```

#### 스트리밍 복구 경로 정합화
```typescript
// resumable stream 활성화 여부 결정 후 코드 통일
const ENABLE_RESUMABLE_STREAM = process.env.ENABLE_RESUMABLE_STREAM === 'true';

if (ENABLE_RESUMABLE_STREAM) {
  const streamPath = getResumableStreamPath(id);
  // 복구 로직 활성화
}
```

#### 테스트 확대
```bash
# 테스트 구조
tests/
├── api/
│   ├── search.test.ts          # API 입력 검증
│   ├── auth.test.ts            # 권한 테스트
│   └── streaming.test.ts       # 스트리밍 테스트
├── tools/
│   ├── web-search.test.ts      # 도구 호출 테스트
│   └── code-interpreter.test.ts
└── e2e/
    └── chat-flow.test.ts       # E2E 시나리오
```

| 문제 | 해결방안 |
|------|----------|
| any 타입 | 구체적 타입 정의 및 적용 |
| 에러 처리 | 모든 catch 블록에 로깅 + 컨텍스트 추가 |
| 중복 코드 | 공통 유틸리티로 추출 (`lib/utils/telegram.ts` 등) |
| N+1 쿼리 | `Promise.all()` 병렬 처리 적용 |
| 메모이제이션 | `useCallback`, `useMemo` 적용 |

---

### P2 - 장기 개선 (1-2개월) 🟡

#### 의존성 안정화

```json
// package.json 수정
{
  "dependencies": {
    "next": "15.1.0",           // 안정판으로 변경
    "react": "19.0.0",          // 안정판
    "better-auth": "^1.0.0"     // 정식 릴리스로 전환
  }
}
```

#### Observability 구축

```typescript
// lib/logger.ts - 구조화 로그
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['password', 'token', 'apiKey'],  // 민감 정보 제거
});

// 에러 트래킹
import * as Sentry from '@sentry/nextjs';
Sentry.init({ dsn: process.env.SENTRY_DSN });

// 토큰/비용 메트릭 수집
export function trackTokenUsage(model: string, tokens: number, cost: number) {
  // Prometheus/DataDog 등으로 전송
}
```

#### 툴/커넥터 분리

```
현재: lib/tools/* (27개 파일이 혼재)

개선:
lib/
├── tools/
│   ├── providers/
│   │   ├── web/
│   │   │   ├── tavily.ts
│   │   │   ├── exa.ts
│   │   │   └── firecrawl.ts
│   │   ├── social/
│   │   │   ├── twitter.ts
│   │   │   ├── reddit.ts
│   │   │   └── youtube.ts
│   │   └── finance/
│   │       ├── stocks.ts
│   │       └── crypto.ts
│   ├── base-tool.ts          # 공통 인터페이스
│   └── tool-registry.ts      # 도구 등록/조회
```

#### 환경 변수 요구 완화

```typescript
// env/server.ts 수정
export const env = createEnv({
  server: {
    // 기능별 선택적 검증
    XAI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // dev 모드 skipValidation
    ...(process.env.NODE_ENV === 'development' && {
      skipValidation: true,
    }),
  },
  runtimeEnv: process.env,
});

// 런타임에서 기능별 체크
export function isFeatureEnabled(feature: string): boolean {
  const requiredKeys = FEATURE_KEYS[feature];
  return requiredKeys.every(key => !!process.env[key]);
}
```

#### 아키텍처 리팩토링

```
현재 구조:
app/api/search/route.ts (500줄)

개선 구조:
├── services/
│   ├── search.service.ts      # 비즈니스 로직
│   ├── auth.service.ts        # 인증 로직
│   └── cache.service.ts       # 캐싱 로직
└── app/api/search/route.ts    # 라우터만 (50줄 이하)
```

---

#### 상태 관리 통합

```
현재: 로컬 상태 + localStorage + Context 혼용

개선:
├── Zustand 또는 Jotai로 전역 상태 통합
├── TanStack Query로 서버 상태 관리
└── 로컬 상태는 컴포넌트 레벨만
```

---

#### 테스트 인프라 구축

```bash
# 추가 필요한 패키지
pnpm add -D vitest @testing-library/react @playwright/test msw

# 테스트 구조
tests/
├── unit/           # 유닛 테스트
├── integration/    # 통합 테스트
└── e2e/            # E2E 테스트
```

---

#### 번들 최적화

**파일:** `next.config.ts`
```typescript
experimental: {
  optimizePackageImports: [
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    '@ai-sdk/openai',
    '@ai-sdk/groq',
    '@radix-ui/react-*',
    'lucide-react',
  ],
}
```

---

### 추가 개선 제안 🟢

#### 모니터링 추가

```bash
# 에러 트래킹
pnpm add @sentry/nextjs

# 성능 모니터링 (이미 있음)
# @vercel/analytics, @vercel/speed-insights

# 로그 집계
pnpm add @axiomhq/next
```

---

#### 문서화

```
docs/
├── API.md           # API 문서 (OpenAPI/Swagger)
├── ARCHITECTURE.md  # 아키텍처 다이어그램
├── CONTRIBUTING.md  # 기여 가이드
└── storybook/       # 컴포넌트 문서
```

---

#### CI/CD 강화

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Type Check
        run: pnpm tsc --noEmit
      - name: Lint
        run: pnpm lint
      - name: Security Scan
        uses: github/codeql-action/analyze@v3
      - name: Dependency Audit
        run: pnpm audit
```

---

#### 코드 품질 도구

```json
// package.json 추가
{
  "devDependencies": {
    "eslint-plugin-security": "^2.1.1",
    "eslint-plugin-sonarjs": "^0.24.0",
    "@typescript-eslint/strict-type-checked": "latest"
  }
}
```

---

## 요약

### 문제점 통계

| 카테고리 | 심각도 | 개수 |
|----------|--------|------|
| 보안/프라이버시 | Critical | 8개 |
| 신뢰성/데이터 무결성 | High | 6개 |
| 코드 품질 | Medium | 10+개 |
| 성능 | Medium | 4개 |
| 운영/유지보수 | Medium | 4개 |
| UX/a11y | Low | 3개 |

### 업그레이드 로드맵

```
Week 1-2 (P0)
├── 로그 정리 (민감 정보 제거)
├── 이미지 보안 강화 (dangerouslyAllowSVG, remotePatterns)
├── 공개 API 보호 (인증/레이트리밋)
├── 입력 검증 도입 (Zod)
└── 코드 인터프리터 정리 (finally)

Week 3-6 (P1)
├── 메시지 저장 정합성 (upsert)
├── 캐시 정리 (LRU/TTL)
├── 중복 조회 제거
├── 스트리밍 복구 정합화
└── 테스트 확대

Month 2+ (P2)
├── 의존성 안정화
├── Observability 구축
├── 툴/커넥터 분리
├── 환경 변수 완화
└── 아키텍처 리팩토링
```

### 총평

**강점:**
- 기능적으로 매우 풍부한 AI 검색 플랫폼
- 최신 기술 스택 활용 (React 19, Next.js 15, Vercel AI SDK)
- 다양한 데이터 소스 통합 (27개 AI 도구)
- 멀티 플랫폼 지원 (웹, Telegram)
- 자동화 스케줄링 기능 (Signals)

**개선 필요:**
- 보안 취약점 즉시 수정 필요 (P0) - 로그 노출, 이미지 보안, API 보호
- 데이터 무결성 강화 - 메시지 저장, 입력 검증
- 의존성 안정화 - canary/PR 버전 → 안정판
- 테스트 인프라 구축 - 현재 1개 테스트만 존재
- 아키텍처 리팩토링 - 관심사 분리, 서비스 레이어

---

## 참고 파일

주요 확인 필요 파일:

- `middleware.ts` - 인증 미들웨어
- `lib/auth.ts` - Better Auth 설정
- `lib/secure-telegram-plugin.ts` - Telegram 보안
- `app/api/search/route.ts` - 핵심 검색 API
- `app/api/upload/route.ts` - 파일 업로드
- `components/chat-interface.tsx` - 메인 UI
- `lib/auth-utils.ts` - 인증 유틸리티

---

*이 보고서는 Claude Code에 의해 자동 생성되었습니다.*

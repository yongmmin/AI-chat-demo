# AI Chat

AI 챗봇과 아티팩트 프리뷰를 갖춘 채팅 인터페이스입니다.

왼쪽에서 대화하고, 오른쪽에서 AI가 생성한 코드나 문서를 실시간으로 확인할 수 있는 — Claude의 Artifacts와 유사한 경험을 제공합니다.

---

## 시작하기

```bash
# 의존성 설치 (클라이언트 + 서버)
npm install
cd server && npm install && cd ..

# 환경변수 설정 (선택 — 없어도 내장 시나리오로 동작합니다)
cp .env.example .env

# 개발 서버 실행 — 클라이언트(:5173)와 API 서버(:3100)가 동시에 뜹니다
npm run dev

# 테스트 실행
npm test
```

### AI 모델 설정

서버는 [OpenRouter](https://openrouter.ai/)를 통해 실제 AI 응답을 생성합니다. API 키 없이도 내장 시나리오로 동작하지만, **실제 AI 응답을 확인하며 개발하는 것을 권장합니다.** [무료 모델](https://openrouter.ai/models?q=free)만으로 충분합니다 (신용카드 불필요).

1. https://openrouter.ai/ 에서 계정을 만드세요
2. Dashboard → API Keys에서 키를 발급하세요
3. `.env` 파일에 입력하세요:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

---

## 주요 기능

### 3개 페이지

| 페이지              | 경로        | 역할                                        |
| ------------------- | ----------- | ------------------------------------------- |
| **ChatHomePage**    | `/`         | 최근 세션 목록, 추천 프롬프트, 새 대화 시작 |
| **ChatSessionPage** | `/chat/:id` | 채팅 + 아티팩트 프리뷰 (SSE 스트리밍)       |
| **ChatHistoryPage** | `/history`  | 전체 채팅 기록, 삭제, 페이지네이션          |

### 핵심 구현 포인트

**1. SSE 스트리밍**

`createChatStream()`은 EventSource 인스턴스를 반환합니다. Named event로 세 가지 이벤트를 수신합니다:

| named event      | data 필드                | 설명                  |
| ---------------- | ------------------------ | --------------------- |
| `text_delta`     | `{ content }`            | 채팅 텍스트 누적      |
| `artifact_delta` | `{ content, language? }` | 코드/문서 콘텐츠 누적 |
| `done`           | `{ title? }`             | 스트리밍 완료         |

**2. 2패널 레이아웃**

채팅 페이지는 왼쪽(대화)과 오른쪽(프리뷰)으로 나뉩니다. `artifact_delta`가 수신되면 오른쪽 패널에 실시간으로 표시됩니다.

**3. 에러 핸들링**

서버 API의 비정상 응답에 대한 방어적 처리가 포함되어 있습니다.

**4. 답변 스타일 선택기** (formal / casual / bullet-point)

**5. 마크다운 렌더링** (`react-markdown` + `remark-gfm` + `rehype-highlight`)

**6. 아티팩트 복사 버튼**

---

## 테스트

```bash
npm test              # 전체 테스트 (13개)
npm run test:easy     # Easy 테스트만 (10개)
npm run test:hard     # Hard 테스트만 (3개)
```

---

## 프로젝트 구조

| 파일                   | 설명                 |
| ---------------------- | -------------------- |
| `src/remotes.ts`       | API 호출 함수        |
| `src/types/api.ts`     | TypeScript 타입 정의 |
| `src/pages/Routes.tsx` | 라우트 정의          |
| `src/components/`      | UI 컴포넌트          |
| `src/__test__/`        | 테스트 코드          |
| `server/`              | Express API 서버     |

---

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite, React Router 7
- **Backend**: Hono (Node.js), OpenRouter API
- **Testing**: Vitest, Testing Library
- **Rendering**: react-markdown, remark-gfm, rehype-highlight

---

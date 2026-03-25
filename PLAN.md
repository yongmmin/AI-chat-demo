# AI Chat Frontend - Implementation Plan

## 구현 기준 (우선순위 순)
1. 테스트 통과
2. 에러 처리
3. 코드 품질
4. 커밋 히스토리
5. 스타일링

---

### ✅ Step 1: 공유 레이아웃 & 사이드바 & 라우팅 구조
- `src/components/Layout.tsx` — sidebar | main 레이아웃
- `src/components/Sidebar.tsx` — 세션 목록, 새 대화, 전체 기록 보기
- `src/hooks/useSessions.ts` — getSessions fetch 로직 캡슐화
- `src/pages/Routes.tsx` — `SidebarLayout` nested route로 Home/Chat 공통 적용

### ✅ Step 2: ChatHomePage 스타일링
- "AI Chat" 헤딩, 퀵탭 3×2 그리드 카드
- 입력 필드 + 전송 버튼 (placeholder: "메시지를 입력하세요...", Enter 전송)
- `useOutletContext`로 세션 생성 후 사이드바 갱신

### ✅ Step 3: ChatSessionPage 리팩토링
- 2패널 레이아웃: 채팅(왼쪽) + 아티팩트 프리뷰 슬라이드(오른쪽)
- `src/hooks/useChatStream.ts` — SSE 로직 캡슐화, 타입 적용
- `src/components/MessageBubble.tsx` — user/assistant 메시지 버블
- `src/components/ArtifactPreview.tsx` — "프리뷰 · {language}" 헤더
- Optimistic UI, 자동 스크롤, getSession 실패 시 에러 + 재시도

### ✅ Step 4: 스트리밍 동기화 버그 수정 & 채팅 UX 개선
- 스트리밍 완료 후 streamText 초기화 + 세션 리로드로 서버 메시지 동기화
- 한 글자씩 타이핑 애니메이션 효과 (useChatStream 버퍼 + 타이머)
- assistant 말풍선 스타일 (배경색, 꼬리 모양)
- 채팅 영역 패딩 추가, 스크롤바 숨김

### ✅ Step 5: ChatHistoryPage 스타일링
- 채팅 기록 헤딩, 카드 스타일 세션 목록 (제목 + 삭제 버튼)
- 긴 제목 말줄임 처리, "← 홈으로" 링크 추가

### ✅ Step 6: UX 개선
- `src/components/ChatInput.tsx` — 공통 입력 컴포넌트 추출 (Home/Chat 공유)
- 스트리밍 중 입력창/전송 버튼 비활성화
- 빈 입력 시 전송 버튼 비활성화
- 사이드바 현재 세션 활성 하이라이트
- 빈 세션 목록 시 안내 문구 (사이드바, 히스토리)
- ChatHomePage 세션 생성 중 중복 클릭 방지
- 불필요한 CSS 정리 (home-input → chat-input 통일)

### ✅ Step 7: 사이드바 토글 + 반응형 보정
- `src/pages/Routes.tsx` — sidebar open 상태 및 토글 컨텍스트 관리
- `src/components/Layout.tsx` — sidebar open/closed 클래스 적용
- `src/components/Sidebar.tsx` — 토글 버튼 추가, 닫힘 시 미니바 렌더
- `src/index.css` — 미니바 스타일/트랜지션, 헤더 gap, 홈 컨테이너 포지션 보정
- `src/index.css` — ChatSessionPage 프리뷰 스택(≤900px), 프리뷰 축소(901–1024px)
- `src/index.css` — 모바일 패딩/타이포/메시지 폭, 560px 이하 사이드바 오버레이(z-index)

### ✅ Step 8: 테스트 환경 OpenRouter 가드 + 문서화
- `server/stream.ts` — 테스트 환경에서 OpenRouter 비활성화(시나리오 스트림 고정)
- `README.md` — 무료 모델 SSE 타임아웃 이슈 및 가드 추가 이유 기록

### ✅ Step 9: 답변 스타일 선택기 (보너스)
- `server/types.ts` — `ResponseStyle` 타입 + `Session.style?` 필드 추가
- `server/routes.ts` — 메시지 POST 시 `style` 받아 세션에 저장
- `server/stream.ts` — `buildSystemPrompt(session.style)`로 스타일별 system prompt 분기
- `src/remotes.ts` — `sendMessage(sessionId, content, style?)`
- `src/hooks/useChatStream.ts` — `send(content, onOptimistic?, style?)`
- `src/pages/ChatSessionPage.tsx` — 헤더 우측 `<select>` UI, 미선택 시 style 미전송
- `src/index.css` — `.chat-header` 레이아웃, `.chat-style-select` 스타일


### ✅ Step 10: 마크다운 렌더링 + 복사 버튼 (보너스)
- `react-markdown`, `remark-gfm`, `rehype-highlight` 설치
- `src/components/ArtifactPreview.tsx` — react-markdown으로 artifact 렌더링, rehype-highlight 코드 하이라이팅, 헤더 우측 복사 버튼 (2초 후 원복)
- `src/components/MessageBubble.tsx` — assistant 메시지에 react-markdown 적용, user는 plain text 유지
- `src/pages/ChatSessionPage.tsx` — 스트리밍 중 streamText도 react-markdown으로 실시간 렌더링
- `src/index.css` — artifact-header space-between, 복사 버튼 스타일, 프리뷰 패널 너비 550px


---

## 테스트 안전 체크리스트
절대 깨지면 안 되는 셀렉터:
- `screen.getByRole("textbox")` — input 1개
- `screen.getByRole("button", { name: /전송|보내기|send/i })`
- `screen.getByRole("button", { name: /삭제|delete/i })`
- `document.body.textContent`에 "null" 없어야 함
- artifact는 `<pre>` 또는 `<code>` 내부
- "답변 생성 중" — 스트리밍 중 표시, done 시 제거

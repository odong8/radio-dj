# 내 방의 라디오 DJ

> **지금, 당신의 방에서만 들리는 작은 방송.** 기분과 한 줄 사연을 입력하면 AI DJ가 개인화된 심야 라디오 대사와 음성으로 들려주는 반응형 웹앱입니다.

![내 방의 라디오 DJ 아키텍처](docs/architecture/room-radio-dj-architecture.png)

## 과제 제출 산출물

| 항목 | 위치 |
|---|---|
| 제품 요구사항 정의서(PRD) | `docs/prd/내방의라디오DJ_PRD.md` 및 PDF |
| 웹앱 설명서 | `docs/guide/내방의라디오DJ_웹앱설명서.md` 및 PDF |
| GitHub·Vercel 배포 가이드 | `docs/guide/GitHub_Vercel_배포가이드.md` |
| 아키텍처 원본·이미지 | `docs/architecture/room-radio-dj-architecture.mmd`, `.png` |
| 과제 요구 매핑 | `docs/submission-requirements.md` |

## 주요 기능

- 5가지 기분과 1~5 에너지 레벨, 4개 DJ 모드, 120자 한 줄 사연 입력
- Lily·Liam·River·Chris의 서로 다른 DJ 보이스 미리듣기
- LLM 기반 제목·오프닝·본문·클로징 생성과 불완전 응답 자동 재시도
- ElevenLabs TTS 기반 AI DJ 음성 자동 재생
- 기분별 BGM ON/OFF, 보관함(최대 20개), DJ·방송 즐겨찾기
- LocalStorage 기반 브라우저 내 재청취
- 375px 모바일 및 1280px 데스크톱 반응형 UI

## 기술 스택

React 19, TypeScript, Vite, Tailwind CSS, Node.js, Vercel Functions, Zod, Vitest, ElevenLabs Text-to-Speech API, Groq API를 사용했습니다.

## 로컬 실행

```bash
pnpm install
pnpm dev
```

로컬에서는 저장소 루트의 `.env`에 `GROQ_API_KEY`와 `ELEVENLABS_API_KEY`를 넣습니다(`.env`는 `.gitignore` 대상입니다). 외부 배포 시에는 GitHub에 `.env` 파일을 만들지 말고, Vercel Dashboard의 **Settings → Environment Variables**에서 두 키를 직접 등록합니다.

## 테스트와 빌드

```bash
# 타입 검사
pnpm check

# 자동 테스트
pnpm test

# 현재 개발 서버용 빌드
pnpm build

# Vercel 배포용 정적 빌드
VERCEL=1 pnpm run build:vercel
```

## Vercel 배포

이 저장소를 GitHub에 올린 뒤 Vercel에서 Import합니다.

| Vercel 설정 | 값 |
|---|---|
| Framework Preset | Vite |
| Build Command | `pnpm run build:vercel` |
| Output Directory | `dist` |
| 필수 환경 변수 | `GROQ_API_KEY`, `ELEVENLABS_API_KEY` |
| 선택 환경 변수 | `GROQ_MODEL`(기본 `openai/gpt-oss-120b`), `GROQ_FALLBACK_MODEL`(기본 `openai/gpt-oss-20b`) |
| 커스텀 도메인 사용 시 | `ALLOWED_ORIGIN_HOSTS`에 도메인을 쉼표로 등록 (예: `radio.example.com`) |

전체 단계와 Git Import 증빙 캡처 방법은 [배포 가이드](docs/guide/GitHub_Vercel_배포가이드.md)를 참고하세요.

## 보안 및 비용 안내

- API 키는 Vercel 환경 변수로만 관리하고, 클라이언트 코드·GitHub·문서에 넣지 않습니다.
- `/api/generate`와 `/api/synthesize`는 호출할 때마다 Groq·ElevenLabs 크레딧을 소모하므로, `Origin`(없으면 `Referer`)이 로컬 개발 주소·Vercel 배포 도메인·`ALLOWED_ORIGIN_HOSTS`에 등록한 도메인인 요청만 처리합니다. 헤더는 위조할 수 있어 완전한 방어는 아니고, 무차별 호출을 걸러내는 1차 관문입니다.
- 1회 음성 합성에 넘기는 대사는 400자로 제한하고(`MAX_SPEECH_CHARACTERS`), 같은 방송을 다시 들을 때는 브라우저에 캐시된 오디오를 재사용해 크레딧을 아낍니다.
- 음성 MP3는 서버리스 API가 즉시 브라우저로 전달하므로 과제 기본 흐름에는 별도 저장소 토큰이 필요하지 않습니다.
- LLM·ElevenLabs 사용량은 각 제공자의 별도 요금·크레딧 정책을 따릅니다.


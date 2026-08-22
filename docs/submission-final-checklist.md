# 내 방의 라디오 DJ — 과제 최종 제출 점검표

> 기준: 제주 SW미래채움 센터 마스터과정 「AI를 활용하여 바이브 코딩으로 웹앱 만들기」 과제 안내문

| 평가 항목 | 배점 | 준비 상태 | 증빙 파일·확인 위치 | 제출 전 마지막 행동 |
|---|---:|---|---|---|
| 웹앱 설명서 | 20점 | 준비 완료 | `docs/guide/내방의라디오DJ_웹앱설명서.pdf` | PDF의 `[본인 이름으로 변경]`, GitHub·Vercel URL 자리표시자를 실제 정보로 바꾼다. |
| 웹앱 PRD | 10점 | 준비 완료 | `docs/prd/내방의라디오DJ_PRD.pdf` | 제출자 이름과 실제 URL 자리표시자를 바꾼다. |
| GitHub Repository URL | 30점 | 사용자 업로드 필요 | `README.md`, `vercel.json`, `api/`, `client/`, `docs/`, 소스 ZIP | GitHub에서 새 저장소를 만들고 ZIP을 풀어 업로드한 뒤 URL을 복사한다. |
| Vercel 배포 URL | 20점 | 사용자 배포 필요 | `vercel.json`, `package.json`의 `build:vercel`, 배포 가이드 | GitHub 저장소를 Vercel에서 Import하고 환경 변수를 등록해 배포 URL을 복사한다. |
| GitHub Import 증빙 사진 | 10점 | 사용자 캡처 필요 | `docs/guide/GitHub_Vercel_배포가이드.md` 5절 | Vercel `Settings → Git` 또는 `Deployments`에서 저장소명·Ready 상태·주소가 보이게 캡처한다. |
| 오류 없는 실제 실행 | 10점 | 코드·로컬 검증 완료 / 배포 URL 확인 필요 | `docs/pdf-verification.md`, `README.md` | Vercel URL에서 사연 입력 → 방송 대사 → AI 음성 재생을 한 번 확인한다. |

## 이미 준비된 제출 파일

| 파일 | 용도 |
|---|---|
| `docs/prd/내방의라디오DJ_PRD.pdf` | PRD PDF, 5쪽 |
| `docs/guide/내방의라디오DJ_웹앱설명서.pdf` | 웹앱 설명서 PDF, 4쪽 |
| `docs/architecture/room-radio-dj-architecture.mmd` | 수정 가능한 Mermaid 아키텍처 원본 |
| `docs/architecture/room-radio-dj-architecture.png` | 설명서에 포함된 아키텍처 PNG |
| `docs/guide/GitHub_Vercel_배포가이드.md` | GitHub 업로드·Vercel Import·환경 변수·증빙 캡처 안내 |
| `README.md` | 코드 실행·테스트·배포 설정 안내 |
| `/home/ubuntu/room-radio-dj-submission.zip` | `node_modules`, `dist`, 로그를 제외한 제출용 소스 ZIP |

## 검증 증거

| 검증 | 결과 |
|---|---|
| TypeScript 검사 | `pnpm check` 통과 |
| 자동 테스트 | Vitest 17개 통과 |
| 개발 서버용 프로덕션 빌드 | `pnpm build` 통과 |
| Vercel 정적 빌드 | `VERCEL=1 pnpm run build:vercel` 통과 |
| Vercel API 입력 오류 테스트 | POST 이외 요청 405, 잘못된 생성·음성 입력 400 검증 |
| 실제 대사 생성 스모크 테스트 | `/api/generate`가 한국어 4개 필드 JSON을 HTTP 200으로 반환 |
| PDF 검증 | PRD 텍스트 PDF·설명서 이미지 포함 PDF 검증 통과 |
| 화면 검토 | 1280px 2열과 375px 단일 열 전체 화면 확인 |

## Vercel에 꼭 입력할 환경 변수

| 변수명 | 필수 여부 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | 필수 | LLM 방송 대사 생성용 서버 전용 키 |
| `ELEVENLABS_API_KEY` | 필수 | AI DJ 음성 생성용 서버 전용 키 |
| `LLM_MODEL` | 권장 | 예: `gpt-4.1-mini`; 사용하는 LLM 제공자에 맞춘 모델 ID |
| `OPENAI_BASE_URL` | 선택 | OpenAI 호환 제공자를 쓸 경우 `/v1`을 포함한 API 기본 주소 |

API 키의 실제 값은 GitHub 코드, PDF, 캡처 이미지에 절대 넣지 않는다.

## 제출 직전 6단계

1. 제출용 ZIP을 내려받아 압축을 푼다.
2. GitHub에 새 저장소를 만들고 모든 파일을 업로드한다.
3. GitHub URL을 두 PDF의 자리표시자에 입력하고 필요하면 PDF를 다시 저장한다.
4. Vercel에서 GitHub 저장소를 Import하고 `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`를 등록한다.
5. 배포 URL에서 실제 방송 생성과 AI 음성 재생을 확인한다.
6. Vercel Git Import 증빙을 캡처해 두 PDF, GitHub URL, Vercel URL, 캡처 이미지를 과제란에 제출한다.

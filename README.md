# 📻 내 방의 라디오 DJ (Radio DJ)

> **"오늘 밤, 오직 당신만을 위해 들려주는 감성 심야 라디오"**  
> 사용자의 기분과 한 줄 사연을 받아, AI DJ가 나만의 맞춤형 라디오 방송 대본을 작성하고 들려주는 반응형 웹 애플리케이션입니다.

[![Deploy with Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://radio-dj-mu.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 🔗 서비스 바로가기

- **공식 배포 URL:** [radio-dj-mu.vercel.app](https://radio-dj-mu.vercel.app)
- **GitHub 저장소:** [github.com/odong8/radio-dj](https://github.com/odong8/radio-dj)

---

## 💡 프로젝트 소개

밤에 찾아오는 소소한 감정들은 SNS에 올리기엔 너무 공개적이고, 일기장에는 아무런 반응이 돌아오지 않습니다.  
**'내 방의 라디오 DJ'**는 예전 심야 라디오가 주던 **"내 사연에 누군가 반응해 준다"**는 감성적 경험을 1인 청취자를 위해 재현합니다.

- **회원가입/로그인 Zero:** 가입 없이 접속 즉시 사연 입력 가능
- **15초 이내 고품질 방송:** 입력부터 대본 생성, 음성 합성 및 자동 재생까지 한 번의 클릭으로 완성
- **100% 개인정보 보호:** 서버 DB 저장 없이 모든 기록은 사용자의 브라우저(`LocalStorage`)에만 저장

---

## ✨ 핵심 기능

| 기능 | 상세 설명 |
| :--- | :--- |
| 🎙️ **맞춤형 방송 생성** | 기분 5종, 에너지 레벨(1~5단계), DJ 모드 4종, 한 줄 사연(1~120자) 조건 선택 |
| ✍️ **자연스러운 구어체 대본** | AI 티가 나지 않는 구어체 라디오 대본 생성 (제목 · 오프닝 · 본문 · 클로징) |
| 🔊 **고품질 AI 음성 합성** | DJ 모드별 맞춤 보이스로 MP3 음성을 합성하고 완료 시 자동 재생 |
| 🎶 **감성 BGM & Ducking** | 기분별 배경음악 자동 재생, DJ 음성 재생 시 BGM 볼륨 자동 낮춤 기능 |
| 🎧 **DJ 미리듣기 & 오디오 캐시** | DJ 보이스 미리ฟัง 기능 및 이미 합성된 방송 재듣기 시 캐시 활용 |
| 💾 **보관함 & 즐겨찾기** | 최근 방송 20개 저장, 즐겨찾기 보관 및 다시 듣기 모달 지원 |

---

## 🎧 DJ 모드 라인업

- 🥣 **다정한 밤참:** 따뜻하고 부드러운 어조로 지친 하루를 품어주는 DJ
- 🌙 **과몰입 새벽:** 밤의 감성에 깊이 공감하고 이야기를 나누는 DJ
- 🌌 **엉뚱한 우주:** 독특하고 재치 있는 시선으로 분위기를 환기해 주는 DJ
- 🕯️ **차분한 응원:** 담담하지만 진정성 있는 묵직한 응원을 전하는 DJ

---

## 🔄 시스템 아키텍처 및 처리 흐름

상시 운영 서버 및 DB 없이 **정적 프론트엔드 + Vercel Serverless Functions**로 구동되어 서버 유지 비용이 들지 않습니다.

[클라이언트 (React)]
└─ 사연 입력 & 유효성 검사
└─ POST /api/generate
└─ Groq API (openai/gpt-oss-120b / Zod 구조화 검증)
└─ ON AIR 카드 대본 출력
└─ POST /api/synthesize
└─ ElevenLabs API (eleven_flash_v2_5 / 400자 제한)
└─ MP3 음성 자동 재생 & LocalStorage 저장


---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend & UI
- **Framework / Library:** React 19, Vite 7
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS 4
- **State & Storage:** Browser LocalStorage

### Backend & AI API
- **Serverless:** Vercel Functions (Node.js)
- **LLM (대본 생성):** Groq API (`openai/gpt-oss-120b`, 폴백: `gpt-oss-20b`)
- **TTS (음성 합성):** ElevenLabs API (`eleven_flash_v2_5`)
- **Validation & Test:** Zod, Vitest (25개 테스트 케이스 통과)

---


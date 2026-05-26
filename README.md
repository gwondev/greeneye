# GREENEYE — AIoT 기반 리워드형 분리배출 안내 시스템

> **조선대학교 컴퓨터공학전공 산학프로젝트 1 (02)** — 모상만 교수님
> 폐기물 이미지를 **AI**가 분류하고, **IoT 모듈**이 실제 투입을 검증하면 **리워드**를 즉시 지급하는 통합 자원순환 서비스.

**서비스 URL**: <https://greeneye.gwon.run>
**GIT 저장소**: <https://github.com/gwondev/greeneye>

---

## 목차

1. [한눈에 보기](#한눈에-보기)
2. [핵심 가치](#핵심-가치)
3. [시스템 아키텍처](#시스템-아키텍처)
4. [기술 스택](#기술-스택)
5. [모노레포 구조](#모노레포-구조)
6. [서비스 시나리오 (End-to-End)](#서비스-시나리오-end-to-end)
7. [데이터 모델 (ERD 요약)](#데이터-모델-erd-요약)
8. [MQTT 프로토콜 명세](#mqtt-프로토콜-명세)
9. [REST API 요약](#rest-api-요약)
10. [AI 분류 정책 (Gemini)](#ai-분류-정책-gemini)
11. [리워드 정책](#리워드-정책)
12. [로컬 개발 환경](#로컬-개발-환경)
13. [배포 (Docker Compose + Cloudflare Tunnel)](#배포-docker-compose--cloudflare-tunnel)
14. [IoT 펌웨어 빌드/업로드](#iot-펌웨어-빌드업로드)
15. [환경 변수](#환경-변수)
16. [시험 결과](#시험-결과)
17. [트러블슈팅 (개발 중 해결한 이슈)](#트러블슈팅-개발-중-해결한-이슈)
18. [팀 구성](#팀-구성)
19. [경진대회 / 수상](#경진대회--수상)
20. [향후 계획](#향후-계획)

---

## 한눈에 보기

| 영역 | 구성 | 한 줄 요약 |
|------|------|-----------|
| **WEB** | React 19 + Vite, MUI, react-leaflet | 지도 기반 모듈 선택 + 카메라/리워드 UI |
| **API** | Spring Boot 4 (Java 21) + JPA | 인증·AI·MQTT·리워드·관리자 API |
| **DB** | MySQL (배포) / H2 (로컬) | User · Module · DisposalRecord · RewardHistory |
| **AI** | Gemini 2.5 Flash (REST) | CAN / PET / GENERAL / HAZARD 4종 분류 |
| **IoT** | ESP32 + HC-SR04 + RGB LED (PlatformIO) | 초음파 투입 감지 → MQTT 상태 전송 |
| **MQTT** | Eclipse Mosquitto (TCP 1883, WS 9001) | `greeneye/{serial}/cmd \| status \| events` |
| **INFRA** | Docker Compose + Cloudflare Tunnel + GitHub Actions | On-Premise(Ubuntu 24.04) 24/7 운영 |

---

## 핵심 가치

- **AI 기반 분리배출 안내** — 사용자가 폐기물 이미지를 촬영/업로드하면 Gemini API가 `CAN / PET / GENERAL / HAZARD`로 분류하고, 배출 안내를 직관적으로 제공합니다.
- **IoT 기반 실투입 검증** — 사용자가 지도에서 선택한 모듈은 서버 → MQTT → ESP32로 `READY`가 전달되고, 초음파 센서가 일정 시간(10초) 안에 투입을 감지해야만 리워드가 지급됩니다.
- **리워드 → 상생 혜택 교환** — 정상 배출 시 즉시 포인트가 적립되고, 리워드 마켓에서 상품권 등으로 교환할 수 있습니다.
- **모듈형/저비용 구조** — 기존 캔 회수기·자판기형 회수기에도 부착 가능한 경량형 모듈을 지향하여 B2B/B2G 확장 가능.

---

## 시스템 아키텍처

```text
            ┌────────────────────────────────────────────────────────────┐
            │                  https://greeneye.gwon.run                 │
            │                  (Cloudflare Tunnel)                       │
            └─────────────────────┬──────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
   ┌──────────────────────┐    ┌────────────────────────┐    ┌───────────────┐
   │  Web (React + Vite)  │───►│  Backend (Spring Boot) │───►│  MySQL (JPA)  │
   │  - Google OAuth      │    │  - /api/auth/google    │    └───────────────┘
   │  - 지도(Leaflet)     │    │  - /api/ai/analyze     │
   │  - 카메라/리워드 UI  │    │  - /api/modules/*      │           ▲
   │  - 관리자/Mosquitto  │    │  - MQTT pub/sub        │           │ JPA
   └──────────────────────┘    └─────────┬──────────────┘           │
                                          │ MQTT (paho)             │
                                          ▼                          │
                               ┌──────────────────────┐              │
                               │  Eclipse Mosquitto   │              │
                               │  1883 (TCP)          │              │
                               │  9001 (WebSocket)    │              │
                               └─────────┬────────────┘              │
                                          │ WS via Cloudflare        │
                                          ▼                          │
                               ┌──────────────────────┐              │
                               │  ESP32 (PlatformIO)  │              │
                               │  - HC-SR04 초음파    │──────────────┘
                               │  - RGB LED (R/G/B)   │   상태 갱신
                               │  - greeneye/<sn>/*   │
                               └──────────────────────┘
```

- 외부 ESP32는 백엔드가 노출하는 `/api/iot/config`로 브로커 주소를 받아 사용합니다.
  현재 펌웨어는 `ws://mqtt-greeneye.gwon.run:80` (Cloudflare Tunnel WebSocket)로 접속합니다.

---

## 기술 스택

### Frontend (`frontend/`)
- **React 19**, **Vite 8**, **MUI 7**, **framer-motion**
- **react-leaflet 5 + OpenStreetMap** (지도)
- **@react-oauth/google** (Google 로그인)
- 절대경로 `/api` 또는 `VITE_API_BASE_URL`로 백엔드 호출

### Backend (`backend/`)
- **Spring Boot 4.0.4 / Java 21 / Gradle**
- **Spring Web · WebFlux · Validation · Mail · Data JPA · Security**
- **Paho MQTT v3 + Spring Integration MQTT**
- **Google API Client** (Google ID Token 검증)
- **Lombok**, **MySQL Connector/J**, H2 (local profile)

### IoT (`greeneye_iot/`)
- **PlatformIO + Arduino framework (espressif32)**
- **esp-mqtt (WebSocket)** · **ArduinoJson** · **HC-SR04** · **RGB LED PWM(LEDC)**
- NTP 시각 기반 stale `cmd` 폐기, MAC 결합 `client_id`

### Infrastructure
- **Docker / Docker Compose** — backend, frontend, mosquitto 3-컨테이너
- **Eclipse Mosquitto 2** (MQTT + WebSocket)
- **Cloudflare Tunnel** (`gwon.run`, `mqtt-greeneye.gwon.run`)
- **GitHub Actions** (CI/CD)
- **Ubuntu 24.04.3 LTS** (On-Premise 서버, 24시간 운영)

---

## 모노레포 구조

```text
greeneye/
├── backend/                       # Spring Boot (Java 21)
│   ├── src/main/java/com/greeneye/backend/
│   │   ├── BackendApplication.java
│   │   ├── config/                # SecurityConfig, WebClientConfig, DevUserBootstrap
│   │   ├── controller/            # Auth/Ai/Module/User/Admin/Mosquitto/IotConfig
│   │   ├── entity/                # User, Module, DisposalRecord, RewardHistory
│   │   ├── repository/            # JPA Repositories
│   │   ├── mqtt/                  # GreeneyeMqttTopics
│   │   └── service/               # Mqtt(Pub/Sub/Handler), Disposal, RewardMail, Log
│   ├── src/main/resources/
│   │   ├── application.yaml       # 배포 기본
│   │   └── application-local.yaml # H2 + dev user
│   ├── build.gradle               # Spring Boot 4 / Java 21
│   └── Dockerfile                 # eclipse-temurin 21 JDK→JRE 멀티스테이지
│
├── frontend/                      # React + Vite
│   ├── src/
│   │   ├── App.jsx                # 라우터 + 보호 라우트(USER/ADMIN)
│   │   ├── main.jsx               # GoogleOAuthProvider 래핑
│   │   ├── pages/                 # Root / Map / Camera / Input / RewardMarket / Manage / DB / Mosquitto …
│   │   ├── services/              # api.js, auth.js
│   │   └── constants/wasteLabels.js
│   ├── vite.config.js             # /api → 127.0.0.1:8080 프록시
│   └── Dockerfile                 # node:24-alpine + `serve -s dist`
│
├── greeneye_iot/                  # ESP32 펌웨어 (PlatformIO)
│   ├── src/main.cpp               # WiFi → NTP → MQTT(WS) → 초음파/LED 상태머신
│   ├── platformio.ini             # build_flags = -DGREENEYE_MODULE_SERIAL=g10
│   ├── iot.cmd / force-upload.cmd # Windows 빌드 헬퍼
│   └── sdkconfig.defaults
│
├── greeneye_HW/                   # 하드웨어 자산
│   ├── greeneye_modeling(OpenSCAD).scad
│   ├── greeneye_modeling(STL FILE).stl
│   ├── 소스코드, 모델링화면.pdf
│   └── 파일설명.txt
│
├── mosquitto/
│   └── config/mosquitto.conf      # 1883(MQTT), 9001(WebSockets)
│
├── scripts/
│   └── prepare-env.sh             # 상위 .env.production → backend/frontend .env 분리 생성
│
├── docker-compose.yml             # backend / mosquitto / frontend (global_network)
└── README.md                      # ← 본 문서
```

---

## 서비스 시나리오 (End-to-End)

1. **Google 로그인** → 신규 사용자는 닉네임 설정 화면(`/nickname`)으로 이동.
2. **지도 진입(`/map`)** — 사용자 위치/모듈 위치 표시. 최초 진입 시 `+1` 리워드 1회 지급(`/api/users/claim-map-entry-reward`).
3. **카메라(`/camera`)** — 이미지 업로드 → `POST /api/ai/analyze` (`multipart/form-data`)
   - Gemini가 첫 줄에 `CAN | GENERAL | PET | HAZARD` 중 하나를 반환.
   - 사용자 보조 선택(`userSelectedType`) 있으면 우선 적용.
   - 분석 성공 시 `+1` 리워드 지급, 일일 10회 / 1분 간격 Rate Limit.
4. **모듈 선택 → 버리기** — `POST /api/modules/{serial}/ready`
   - DB: 새 `DisposalRecord(PENDING)` 생성, 이전 PENDING은 `FAILED` 처리.
   - 모듈 상태: `DEFAULT → READY`.
   - MQTT publish: `greeneye/{serial}/cmd` `{ "userId":"<nickname>", "issuedAt":<ms> }` (retained=true, QoS1)
5. **ESP32 측 동작**
   - `cmd` 수신 → 10초 타이머 시작 + LED 노란색.
   - 초음파 기준선 대비 **20cm 이상 감소가 연속 5틱(약 325ms)** 유지되면 → `status` topic에 `CHECK` publish, LED 녹색.
   - 10초 안에 미감지 → `status` topic에 `READY` (timeout) publish.
   - 60분 이상 10cm 미만이 유지되면 `FULL` publish.
6. **서버 후속 처리** — `MqttSubscriberService`가 `greeneye/+/status`, `greeneye/+/events` 구독:
   - `CHECK` → `ModuleDisposalService.completeDisposalCheck` → `+10` 리워드 지급, 모듈 `CHECK → DEFAULT`로 복귀, `RewardHistory` 기록.
   - `READY`(timeout) → 가장 최근 PENDING을 `FAILED` 처리, 모듈 `DEFAULT`.
   - `FULL` → 모듈 상태 `FULL`.
7. **리워드 마켓(`/reward_market`)** — `POST /api/users/{id}/exchange`
   - 보유 포인트 차감 + 코드 발급(`A–Z2–9` 10자리). SMTP 설정 시 메일 발송, 미설정 시 코드만 발급.

---

## 데이터 모델 (ERD 요약)

| 테이블 | 주요 컬럼 | 비고 |
|--------|----------|------|
| `users` | `id`, `oauth_id(uniq)`, `email`, `nickname(uniq)`, `role(USER/ADMIN)`, `status`, `now_rewards`, `total_rewards`, `camera_daily_count`, `camera_daily_date`, `last_camera_at`, `map_entry_reward_claimed` | Google sub = `oauthId` |
| `modules` | `id`, `serial_number(uniq)`, `organization`, `lat`, `lon`, `type(CAN/PET/GENERAL/HAZARD/GOV_*)`, `status(DEFAULT/READY/CHECK/FULL)`, `total_disposal_count`, `last_heartbeat` | `serial_number`이 MQTT 토픽 키 |
| `disposal_records` | `id`, `user_id(FK)`, `module_id(FK)`, `image_url`, `predicted_type`, `selected_type`, `reward_amount`, `status(PENDING/SUCCESS/FAILED)`, `created_at`, `verified_at` | 1 배출 = 1 record |
| `reward_histories` | `id`, `user_id(FK)`, `disposal_record_id(FK, uniq)`, `points`, `reason`, `created_at` | 1 record당 1 history |

JPA `ddl-auto: update`로 스키마는 엔티티 변경 시 자동 반영됩니다 (배포 동일).

---

## MQTT 프로토콜 명세

토픽 헬퍼: `GreeneyeMqttTopics` (서버) / `topicCmd()/topicStatus()` (펌웨어)

| 방향 | 토픽 | Payload 예시 | 의미 |
|------|------|-------------|------|
| 서버 → 모듈 | `greeneye/{serial}/cmd` (retained, QoS1) | `{"userId":"그린이","issuedAt":1737000000000}` | 사용자 닉네임으로 READY 시작 |
| 모듈 → 서버 | `greeneye/{serial}/status` | `{"status":"CHECK","userId":"그린이"}` | 투입 감지 성공 |
| 모듈 → 서버 | `greeneye/{serial}/status` | `{"status":"READY","userId":"그린이"}` | 10초 타임아웃 (실패) |
| 모듈 → 서버 | `greeneye/{serial}/status` | `{"status":"FULL","moduleSerial":"g1"}` | 1시간 이상 10cm 미만 → 가득참 |
| 모듈 → 서버 | `greeneye/{serial}/events` | `{"status":"FULL"}` | 보조 이벤트 채널 |

**Stale 방지** — 펌웨어는 NTP 시각과 `issuedAt`을 비교해 10분 초과 또는 미래(+5분 초과) `cmd`를 폐기합니다. 동일 `client_id`로 재접속해도 retained 메시지가 재처리되지 않습니다. 서버 측은 `ModuleIotMqttHandler`가 동일 모듈·유저의 `CHECK`를 2.5초 이내 중복 시 1건만 처리합니다.

---

## REST API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/auth/google` | Google ID Token 검증 → 사용자 upsert + DTO 반환 |
| `PUT` | `/api/auth/nickname` | 신규 사용자 닉네임 설정 (중복 방지) |
| `POST` | `/api/ai/analyze` (multipart) | Gemini 호출, 분류 + 리워드 `+1` |
| `GET / POST / PUT / DELETE` | `/api/modules` | 모듈 CRUD |
| `POST` | `/api/modules/seed` | 데모용 `g1(CAN), g2(PET)` 시드 |
| `POST` | `/api/modules/{serial}/ready` | READY 전환 + MQTT publish |
| `POST` | `/api/modules/{serial}/check` | (수동 호출용) CHECK 처리 |
| `POST` | `/api/users/claim-map-entry-reward` | 지도 최초 진입 시 `+1` |
| `POST` | `/api/users/{id}/exchange` | 리워드 차감 + 메일 코드 발급 |
| `GET` | `/api/admin/overview` | users/modules/records/histories 통합 조회 |
| `GET` | `/api/mosquitto/logs` | 최근 MQTT 트래픽 로그 (관리자 화면) |
| `GET` | `/api/mosquitto/diag` | 백엔드가 붙은 브로커 URL/연결 상태 |
| `GET` | `/api/iot/config` | ESP32용 브로커 호스트/포트 노출 |

CORS 허용 Origin (`SecurityConfig`):
`https://greeneye.gwon.run`, `https://gwon.run`, `http://localhost:5173`, `http://127.0.0.1:5173`

---

## AI 분류 정책 (Gemini)

`AiController.VISION_PROMPT` — 첫 줄에 단일 토큰을 강제하여 파싱 안정성을 확보합니다.

```text
대한민국 분리배출 관점에서 이미지의 주된 폐기물을 분류하라.
첫 줄에는 아래 네 단어 중 정확히 하나만 출력하라: CAN, GENERAL, PET, HAZARD
- CAN     : 알루미늄·철 캔 등 금속 캔
- GENERAL : 일반쓰레기 (재활용·캔·페트에 해당하지 않는 경우)
- PET     : 페트병·플라스틱 병류 (페트 위주)
- HAZARD  : 배터리·스프레이캔·유해/위험 폐기물
```

- 모델: `gemini-2.5-flash` (기본값, `GEMINI_MODEL`로 override 가능)
- Rate Limit: **하루 10회 / 호출 간 60초 간격** (`User.cameraDailyCount`, `lastCameraAt`)
- 호출 실패 시 `502 BAD_GATEWAY` + 응답 본문 일부를 함께 반환해 디버깅 용이.

---

## 리워드 정책

| 트리거 | 포인트 | 코드 위치 |
|--------|-------|----------|
| 지도 최초 진입 (계정당 1회) | `+1` | `UserController.claimMapEntryReward` |
| AI 분석 성공 | `+1` | `AiController.commitCameraUsage` |
| 모듈 CHECK 완료 (실제 배출) | `+10` | `ModuleDisposalService.DISPOSAL_REWARD` |
| 리워드 마켓 교환 | `-cost` | `UserController.exchangeReward` |

`User.now_rewards` 는 현재 보유, `total_rewards`는 누적입니다.

---

## 로컬 개발 환경

### 1) Backend (IDE / `local` profile, H2)

```bash
# 환경변수 (PowerShell 예시)
$env:SPRING_PROFILES_ACTIVE = "local"
$env:GREENEYE_DEV_USER_ENABLED = "true"
$env:GOOGLE_CLIENT_ID = "<생략 가능, /api/auth/google 미사용 시>"
$env:GEMINI_API_KEY = "<Gemini 키>"

cd backend
./gradlew bootRun
```

- H2 인메모리 + `DevUserBootstrap`이 `oauthId=dev-local-greeneye`, `nickname=gwon`, `role=ADMIN` 유저를 자동 생성합니다.
- 프론트의 `services/auth.js`의 `isDevBypass()`(VITE_ALLOW_DEV_BYPASS=true)와 짝을 이룹니다.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

- `.env.development`에 `VITE_API_BASE_URL=https://greeneye.gwon.run/api`가 설정되어 있어 **API/DB는 배포 서버를 그대로 사용**합니다.
- 로컬 백엔드를 함께 띄울 때만 `.env.development`에서 해당 줄을 지우거나 `VITE_API_BASE_URL=/api`로 바꾸면 Vite 프록시(`/api → 127.0.0.1:8080`)가 동작합니다.

### 3) Mosquitto (로컬 MQTT가 필요할 때)

```bash
docker run --rm -p 1883:1883 -p 9001:9001 \
  -v "$PWD/mosquitto/config:/mosquitto/config" \
  eclipse-mosquitto:2
```

---

## 배포 (Docker Compose + Cloudflare Tunnel)

서버: **Ubuntu 24.04.3 LTS On-Premise**, 외부 노출은 **Cloudflare Tunnel + Published Application Routes**.

```bash
# 1) 상위 .env.production 준비 (저장소 밖)
#    필수: GOOGLE_CLIENT_ID_GREENEYE, GREENEYE_GEMINI_API_KEY,
#         DB_PASSWORD, KAKAO_API
#    선택: DB_USERNAME(default gwon), MQTT_BROKER_URL, MQTT_CLIENT_ID, VITE_API_BASE_URL

# 2) backend/.env.production · frontend/.env.production 자동 생성
chmod +x scripts/prepare-env.sh
./scripts/prepare-env.sh ../.env.production

# 3) 외부 네트워크가 없다면 한 번만 생성
docker network create global_network

# 4) 빌드 & 기동
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

`docker-compose.yml`은 3개의 컨테이너를 정의합니다 — `greeneye-backend`, `greeneye-frontend`, `greeneye-mosquitto`. 모두 외부 `global_network`(다른 스택과 공유)에 붙고, Mosquitto는 호스트 포트를 노출하지 않아 같은 네트워크 안에서 `mosquitto:1883`으로만 접근합니다. DB는 같은 네트워크의 `gwon-db:3306/greeneye`에 연결됩니다.

Cloudflare Tunnel 라우팅 예:
- `greeneye.gwon.run` → 프론트엔드(컨테이너 5173) + 백엔드(`/api/*`)
- `mqtt-greeneye.gwon.run:80` (WebSocket) → `mosquitto:9001`

---

## IoT 펌웨어 빌드/업로드

```bash
# 1) PlatformIO 설치 (CLI 또는 VSCode 확장)
# 2) 모듈 시리얼 변경 — platformio.ini
#    build_flags = -DGREENEYE_MODULE_SERIAL=g10   (g1, g2 …)
# 3) 빌드 & 업로드
cd greeneye_iot
pio run -t upload
pio device monitor -b 115200
```

Windows에서 PowerShell의 `pio`가 store-alias로 막히는 경우 `iot.cmd run -t upload`를 사용하세요(내부적으로 winget Python 3.12 절대경로를 사용합니다).
완전 재빌드는 `force-upload.cmd`.

펌웨어 주요 상수 (`src/main.cpp`):
- `MQTT_WS_URI` = `ws://mqtt-greeneye.gwon.run:80`
- `FULL_DETECT_MS` = 1시간, `FULL_NEAR_CM` = 10cm
- `READY_DELTA_CM` = 20cm, `READY_DROP_TICKS_REQUIRED` = 5틱 (~325ms)
- `keepalive` = 30s, `reconnect_timeout_ms` = 8s, Wi-Fi down debounce 500ms
- `client_id` = `<serial>-<MAC6byte>` (세션 충돌 방지)

LED 신호 (RGB PWM, R=25/G=26/B=27):
- **빨강** = `DEFAULT` / `FULL`
- **노랑(255,50,0)** = `READY` (입력 대기)
- **초록** = `CHECK` 성공 → 약 10초 표시 후 DEFAULT 복귀

---

## 환경 변수

`scripts/prepare-env.sh`가 **단일 상위 `.env.production`**에서 다음 키들을 읽어 `backend/.env.production`, `frontend/.env.production`을 안전 모드(0600)로 생성합니다.

| 키 | 용도 | 어디서 쓰는가 |
|----|------|--------------|
| `GOOGLE_CLIENT_ID_GREENEYE` | Google OAuth Client ID | 백엔드 검증 + 프론트 로그인 버튼 |
| `GREENEYE_GEMINI_API_KEY` | Gemini API Key | `AiController` |
| `DB_USERNAME` (default `gwon`) | MySQL 사용자 | `application.yaml` |
| `DB_PASSWORD` | MySQL 비밀번호 | `application.yaml` |
| `KAKAO_API` | (참고) KakaoMap JS 키 | 프론트 (`VITE_KAKAO_API`) |
| `MQTT_BROKER_URL` (default `tcp://mosquitto:1883`) | 브로커 URL | `Mqtt(Pub/Sub)Service` |
| `MQTT_CLIENT_ID` (default `greeneye-backend`) | 백엔드 client_id 접두 | 위와 동일 |
| `VITE_API_BASE_URL` (default `/api`) | 프론트 API 베이스 | `services/api.js` |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM` | 리워드 교환 메일 | `RewardMailService` (미설정 시 코드만 발급) |
| `GREENEYE_DEV_USER_ENABLED` (local만 `true`) | dev 시드 유저 활성 | `DevUserBootstrap` |

> `.env*`는 모두 `.gitignore` 대상입니다. **절대 커밋 금지.**

---

## 시험 결과

보고서 §11에서 발췌:

- **End-to-End** (웹 로그인 → 촬영 → 모듈 선택 → ESP32 투입 → 리워드 지급)
  - 모든 구간(웹 → 서버 → MQTT → ESP32 → 서버 → DB) 정상 연결.
  - **투입 감지 → 리워드 지급까지 약 0.5초 이내**.
  - **10초 내 미투입 시 FAILED 처리 및 상태 복원** 정상 동작.
- **Gemini 분류**
  - 단일 물체·깨끗한 배경에서 높은 정확도, 복잡한 배경에서는 정확도 하락.
  - **하루 10회 / 1분 간격 Rate Limit** 정상 적용.
- **Docker 통합 배포**
  - backend / frontend / mosquitto 3-컨테이너 일괄 기동, ESP32가 Cloudflare WS 경유 정상 연동.
  - 컨테이너 재시작 시 MQTT 자동 재접속, 메시지 유실 없음.

---

## 트러블슈팅 (개발 중 해결한 이슈)

보고서 §12와 동일.

- **MQTT 재접속 시 과거 명령 중복 실행**
  → `cmd` payload에 `issuedAt`(ms) 포함, 펌웨어는 NTP 시각과 비교하여 10분 초과 시 폐기. `client_id`에 MAC을 결합해 세션 충돌 방지.
- **초음파 센서 투입 오탐(False Positive)**
  → 단일 측정 대신 **기준선 대비 20cm 이상 감소가 연속 5틱(약 325ms) 유지** 시에만 CHECK 판정.
- **Cloudflare WS MQTT 주기적 끊김**
  → `keepalive=30s`, `reconnect_timeout=8s`, Wi-Fi 끊김 500ms 디바운스 적용.
- **Google OAuth ENV 누락 (Docker)**
  → 프론트는 Vite의 `VITE_*` 규칙으로 통일, 백엔드는 `docker-compose.yml`의 `env_file`로 `.env.production`을 명시 주입.
- **카카오맵 SDK 차단**
  → 개발자 콘솔에서 `localhost:5173`·`greeneye.gwon.run` 도메인 등록 + 결제 카드 등록, SDK 로드 실패 시 디버그 메시지 노출.

---

## 팀 구성

| 직책 | 이름 | 학번 | 역할 |
|------|------|------|------|
| 팀장 | **이성권** | 20233189 | PL, INFRA, DevOps, IoT, HW (전 구조 설계·배포·하드웨어) |
| 팀원 | 주혜림 | 20233177 | Security, Auth, API Key, Spring Security |
| 팀원 | 임정은 | 20233163 | Frontend, API 연동, Realtime, WebSocket |
| 팀원 | 김수민 | 20233137 | Backend, DB, API, ERD, JPA |
| 팀원 | 김예은 | 20233138 | UI/UX, Figma, Prototype, Documentation |

> 조선대학교 컴퓨터공학전공 · 산학프로젝트 1 (02) · 지도교수 모상만.

---

## 경진대회 / 수상

| 구분 | 대회명 | 주최 | 결과 |
|------|--------|------|------|
| 교내 | 제9회 AI ROBOTICS 융합 아이디어 경진대회 | 조선대학교 | **장려상 (입상)** |
| 교외 | 2026 AX 아이디어 경진대회 | 기후에너지환경부 | 출품 |
| 교외 | 2026 ICT 융합프로젝트 공모전 | DEVICEMART | 출품 |
| 교외 | 2026년 감축탄소 아이디어 경진대회 | 화성시환경재단 | 출품 |

---

## 향후 계획

- **추가 검증** — 무게 변화·카메라 센서 등 다중 검증으로 정교화.
- **데이터 기반 운영** — 시간대별 배출량·품목 통계 시각화, 통합 관제 대시보드.
- **저전력화** — ESP32 Deep Sleep + 이벤트 기반 깨우기, 배터리/태양광 구동.
- **장애 모니터링** — Grafana/Prometheus 또는 Sentry로 디바이스 오프라인/백엔드 오류 알림.
- **B2B 확장** — 기존 자원회수장치(수퍼빈 네프론 등)와 연계되는 보완형 AIoT 플랫폼화.

---

## License

본 저장소는 학부 캡스톤(산학프로젝트) 산출물로 공개되며, 상업적 이용 전 팀에 문의 바랍니다
프로젝트 문의: gwondev0323@gmail.com
=======
# greeneye



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://git.chosun.ac.kr/gwon/greeneye.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://git.chosun.ac.kr/gwon/greeneye/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> 28491b6c5c59824b48dae49523464dea24d6fc8d

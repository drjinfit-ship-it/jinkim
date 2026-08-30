# 포터블 상시 에이전트 [마이] — 설계안

## 0. 설계 원칙

1. **단일 루트 폴더**: 에이전트에 관련된 모든 것(모델·설정·프롬프트·기억·로그)이
   `MAI_HOME` 한 곳 아래에만 존재한다. 그 폴더를 통째로 복사하면 다른 맥/외장 SSD에서
   그대로 동작한다 → 이것이 "포터블"의 정의.
2. **절대경로 금지**: 모든 스크립트는 `MAI_HOME` 기준 상대경로만 사용.
3. **상시성 = launchd**: 로그인 시 자동 기동, 죽으면 자동 재시작(`KeepAlive`).
4. **모델 교체 가능**: 모델 ID는 `mai.env` 환경변수 하나. 런타임/프롬프트는 모델과 분리.
5. **기억은 파일로**: DB 락 없는 평문(Markdown/JSONL) 우선 → 백업·이관·검열·버전관리 용이.

## 1. 폴더 레이아웃

```
$MAI_HOME/                     # 기본값 ~/MAI, 외장 SSD면 /Volumes/<디스크>/MAI
├── bin/
│   └── mai                    # 단일 진입점 CLI (start/stop/status/chat/ask/logs)
├── config/
│   ├── mai.env                # 모델 ID, 포트, 컨텍스트 길이 등 (git 미추적)
│   └── mai.env.example        # 템플릿 (git 추적)
├── prompts/
│   ├── system.md              # [마이] 인격/역할/규칙
│   └── tools.md               # 도구 사용 규약
├── models/                    # GGUF/MLX 가중치 (git 미추적, 용량 큼)
├── memory/
│   ├── profile.md             # 사용자 고정 정보 (항상 주입)
│   ├── journal/YYYY-MM-DD.md  # 날짜별 작업 로그
│   └── vectors/               # 선택: 임베딩 인덱스
├── logs/
│   ├── server.log
│   └── server.err.log
└── runtime/
    └── mai.pid
```

## 2. 런타임 스택 (Apple Silicon 기준)

| 계층 | 선택지 | 권장 | 이유 |
|---|---|---|---|
| 추론 엔진 | Ollama / llama.cpp / **MLX** / LM Studio | **MLX-LM** 또는 llama.cpp | MLX는 Apple 통합메모리·Metal에 최적화, 4bit 양자화 1급 지원 |
| 서빙 | `mlx_lm.server` / `llama-server` / `ollama serve` | OpenAI 호환 HTTP (`:11434` 또는 `:8080`) | 어떤 클라이언트든 붙일 수 있어 이식성 최고 |
| 상시 구동 | **launchd (LaunchAgent)** | `~/Library/LaunchAgents/com.jinkim.mai.plist` | 로그인 시 자동 기동 + KeepAlive 재시작 |
| 인터페이스 | `mai` CLI / 웹 UI / 단축어(Shortcuts) / Raycast | CLI 우선, 이후 확장 | CLI가 가장 가볍고 스크립트 조합이 쉬움 |

> **Ollama vs MLX 선택 기준**
> - *Ollama*: 설치·모델관리가 압도적으로 편함. 커스텀 GGUF도 `Modelfile`로 등록 가능. → **초기 세팅 권장**
> - *MLX*: 같은 4bit에서 토큰/초가 대체로 더 빠르고 메모리 효율이 좋음. → **최적화 단계에서 전환**

## 3. 상시 구동 구조

```
로그인
  └─ launchd(LaunchAgent, KeepAlive=true)
       └─ $MAI_HOME/bin/mai serve
            └─ 추론 서버 (127.0.0.1:$MAI_PORT, 루프백 전용 = 외부 노출 없음)
                 ↑
        mai ask / mai chat / Raycast / Shortcuts / 다른 앱
```

- **보안**: 반드시 `127.0.0.1` 바인딩. `0.0.0.0` 금지(카페 와이파이에서 모델이 통째로 열림).
- **절전**: 모델 상주는 RAM을 계속 점유하므로, 배터리 모드에서는
  `MAI_IDLE_UNLOAD=300`(초) 후 언로드 → 요청 시 재적재 정책 권장.

## 4. 포터블 시나리오

| 시나리오 | 방법 |
|---|---|
| 다른 맥으로 이동 | `MAI_HOME` 폴더 복사 → `bin/mai bootstrap` 1회 실행 |
| 외장 SSD 상주 | `MAI_HOME=/Volumes/XXX/MAI` 로 설정, plist도 그 경로 지정. 미마운트 시 자동 스킵 처리 |
| 설정만 동기화 | `models/`·`logs/` 제외하고 이 git 저장소로 관리 (`.gitignore` 참조) |
| 기억 백업 | `memory/`는 평문 → git 또는 iCloud 동기화 가능 |

## 5. 구축 순서

1. `scripts/01-inspect-mac.sh` — **현재 상태 진단** ← *지금 여기*
2. `scripts/02-bootstrap.sh` — 필수 도구 설치 + `MAI_HOME` 생성
3. 모델 내려받기 + `mai.env` 확정
4. `scripts/04-install-service.sh` — launchd 등록 (상시화)
5. `prompts/system.md` — [마이] 인격 튜닝
6. 기억(memory) / 도구(tools) 계층 확장

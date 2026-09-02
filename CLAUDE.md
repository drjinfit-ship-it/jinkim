# CLAUDE.md — 이 저장소에서 작업하는 에이전트를 위한 진입점

이 저장소는 **김진(drjinfit)의 로컬 LLM 인프라와 개인 비서 에이전트 [마이]의
설계·설정·파이프라인**을 담고 있습니다.

> ⚠️ **claude.ai 웹 채팅과 Claude Code 세션은 대화가 연동되지 않습니다.**
> 이 저장소가 세션 간 공유 기억 역할을 합니다. 새 세션을 시작하면 아래 문서를
> 먼저 읽고, 결정이 바뀌면 **반드시 해당 문서를 갱신**하세요.

## 먼저 읽을 것 (순서대로)

| 순서 | 문서 | 내용 |
|---|---|---|
| 1 | `docs/FLEET.md` | **최상위 설계.** 5계층 구조, 하드웨어 인벤토리, 작업 라우팅 정책 |
| 2 | `docs/QWEN38-NEXT.md` | 모델 선정의 최종 판단 (6-6절). 27B 단독 결정과 그 근거 |
| 3 | `docs/AUTOMATION.md` | 녹음→해석→선제실행→보고 파이프라인 |
| 4 | `docs/GPU-STATIONS.md` | RTX 3090 ×8 ×2 — 전력·냉각·NVLink 실무 |
| 5 | `docs/QWEN38-27B-CODING.md` | 로컬 코딩 활용 조사 — 대체 가능성, 하네스, Chrome MCP |
| 6 | `docs/TWO-MACHINE.md` | 맥 2대 동기화 실무 |
| 7 | `docs/MODEL-NOTES.md` | 메모리 튜닝, 양자화 포맷 |

## 하드웨어 (2026-08-30 기준)

| 계층 | 기기 | 역할 |
|---|---|---|
| T0 | MacBook Pro M3 Max 64GB / 2TB | 이동형 자립 노드 |
| T1 | Mac Studio M3 Ultra 96GB **(28c/60c 바이닝)** / 1TB + 외장 2TB | 상시 허브 |
| T2 | Station A: EPYC 7542 + RTX 3090 ×8 (192GB VRAM) + NVLink ×4 | 상시 서빙 |
| T2 | Station B: TR Pro 3975WX + RTX 3090 ×8 (192GB VRAM) | 학습·실험·백필 |
| T3 | Claude Code / Codex / Antigravity (구독) | 프론티어 코딩 |

**M3 Ultra가 바이닝(60코어) 버전이라는 점은 모델 선정에 실제로 영향을 줍니다.**
대역폭은 온전하고 GPU 코어만 깎였으므로 dense 모델이 초희소 MoE보다 유리합니다.

## 확정된 결정

1. **전 계층 Qwen3.8-27B로 통일.** Flash-Next는 지우지 않되 에이전트 A/B용 온디맨드.
   근거: `QWEN38-NEXT.md` 6-6절
2. **전사(STT)는 Mac Studio.** Station B는 재부팅 자유 머신이므로 상시 서비스 금지.
   대량 백필만 스테이션. 근거: `AUTOMATION.md` 2-2절
3. **"절반 먼저"의 정의는 가역성.** 되돌릴 수 있는 것은 전부 하고, 없는 것 앞에서 멈춤.
   이 판단은 `mai/pipeline/gate.py` 화이트리스트로 **코드가 강제**하며 LLM에 맡기지 않음
4. **추론 서버는 항상 `127.0.0.1` 바인딩.** 외부 노출은 Tailscale 계층에서만.
   `tailscale funnel` 금지
5. **Claude Code / Codex 를 LiteLLM 라우터에 태우지 않음.** 구독 인증이 깨짐.
   근거 보강: `ANTHROPIC_BASE_URL` 설정 시 OAuth가 조용히 꺼지고 401 —
   anthropics/claude-code #33330이 **closed (not planned)** 로 닫힘. 고쳐질 계획 없음
6. **로컬 27B는 Claude Code/Codex의 대체가 아니라 역할 분담.**
   판정 기준은 **"자기검증 가능한가"** — 테스트가 통과/실패로 판정해 주는 작업만 로컬.
   근거: `QWEN38-27B-CODING.md` 4절, 6-2절

## 함정 — 이미 한 번씩 틀렸던 것들

| 함정 | 사실 |
|---|---|
| "Qwen3.8-27B는 밀집 표준 어텐션 · 텍스트 전용" | ❌ 64층 중 48층이 Gated DeltaNet(선형), 262K, **네이티브 VLM** |
| "3090에 FP8 모델을 올리면 된다" | ❌ Ampere는 FP8 텐서코어 없음 → BF16 업캐스트 → VRAM 초과 |
| "3090에는 AWQ INT4를 쓰면 된다" | ⚠️ Qwen3.8-27B의 `AWQ-INT4` 배포본을 찾지 못함. 3090 커뮤니티 검증본은 **W4A16 AutoRound**(`dbirks/Qwen3.8-27B-W4A16-AutoRound`). vLLM 공식 레시피 하드웨어 표에 **Ampere가 아예 없음** |
| "4bit면 툴콜도 잘 되겠지" | ⚠️ **4bit가 툴콜을 제대로 닫지 못한다는 보고 있음**(FP8·INT8은 정상). 미검증이지만 3090·MLX 양쪽 경로가 모두 이 구간. **직접 측정할 것** |
| "mlx_lm.server로 코딩 에이전트를 붙이면 된다" | ⚠️ Apple 공식 `mlx_lm.server`는 `tools` 전달 시 빈 응답 반환 보고(mlx-lm #1293). **oMLX 경로**를 쓸 것 |
| "Ollama로 27B 돌리면 된다" | ❌ M3 Ultra에서 14 tok/s. **oMLX + MTP** 경로는 48~65 tok/s |
| "MLX 4bit면 다 같다" | ❌ 같은 Flash-Next도 팩에 따라 39GB ~ 112GB. **REAP-288** 확인 |
| "모델이 메모리에 올라가면 디스크 속도 무관" | ❌ MTPLX 팩은 32GB n-gram 테이블을 SSD에서 **스트리밍** |
| "기본 mlx-whisper면 충분" | ❌ 2~3× 실시간이라 8시간에 3시간. **whisperx-mlx**(52×) 또는 Core ML/ANE(22×) |

## 저장소 규약

- **이 저장소는 public 입니다.** 개인 기억(`mai/memory/`), 녹취·전사(`mai/data/`),
  진단 리포트(`reports/*.md`)는 **절대 커밋하지 마세요.** `.gitignore` 확인
- 기억 동기화는 별도 private 저장소 (`docs/TWO-MACHINE.md` 4-1절)
- 개발 브랜치: `claude/macbook-m2-agent-setup-mbr2me`
- 문서는 한국어. 코드 주석도 한국어
- **판단이 바뀌면 문서에 정정 이력을 남기세요.** 이 저장소에는 이미 여러 정정이
  기록되어 있고, 그게 다음 세션이 같은 실수를 반복하지 않게 합니다

## 코드

| 경로 | 역할 |
|---|---|
| `mai/pipeline/` | 전사→추출→종합→게이트→보고 파이프라인 |
| `mai/pipeline/gate.py` | **가역성 게이트.** 화이트리스트 방식, 미등록 타입은 전부 차단 |
| `config/litellm.yaml` | 로컬 백엔드 통합 라우터. 계층 폴백 포함 |
| `scripts/01-inspect-mac.sh` | 맥 진단 (읽기 전용, 민감정보 마스킹) |
| `scripts/sync-memory.sh` | 기기 간 기억 동기화 (private 저장소 대상) |

파이프라인은 전부 LiteLLM 라우터를 통해 모델에 접근합니다 —
모델이 바뀌어도 파이프라인 코드는 그대로입니다.

## 아직 안 한 것

- [ ] Mac Studio 마이그레이션 검증 (`scripts/01-inspect-mac.sh` 실행)
- [ ] 전력·냉각 인프라 확보 ← **스테이션의 실제 전제조건**
- [ ] Phase 1: STT 백엔드 연결 + 어휘 사전 구축 (`mai/pipeline/transcribe.py`)
- [ ] Tailscale 전 기기 연결
- [ ] 기억용 private 저장소 생성

# 전체 인프라 설계 — 5계층 플릿

> 이 문서가 최상위 설계입니다. `TWO-MACHINE.md` 는 맥 2대 동기화 실무만 다룹니다.

## 1. 하드웨어 인벤토리

| # | 기기 | 스펙 | 역할 | 상태 |
|---|---|---|---|---|
| M1 | **MacBook Pro** | M3 Max / 64GB / 2TB | 이동형 주개발 + [마이] 자립 노드 | 가동 |
| M2 | **Mac Studio** | M3 Ultra / 96GB / 1TB **+ 외장 2TB SSD** | 사무실 주개발 + [마이] 상시 허브 | 마이그레이션 중 |
| G1 | **Station A** | ROMED8-2T + EPYC 7542(32c) + RTX 3090 ×8 = **192GB VRAM** + NVLink 4슬롯 브리지 ×4 | 상시 추론 서빙 | 구축 |
| G2 | **Station B** | WRX80 + TR Pro 3975WX(32c) + RTX 3090 ×8 = **192GB VRAM** | 학습·실험·인덱싱 | 구축 |
| C | **클라우드 에이전트** | Claude Code / Codex / Antigravity | 프론티어 코딩 | 구독중 |

합계 로컬 VRAM **384GB**, 통합메모리 **160GB**.
이 규모면 "로컬로 뭘 할 수 있나"가 아니라 **"무엇을 굳이 클라우드로 보낼 것인가"** 가 질문입니다.

## 2. 계층 구조

```
 T3  Claude Code / Codex / Antigravity        ← 최고난도 설계·코딩. 외부 전송 O
      ↑ 사람이 명시적으로 호출
 ─────────────────────────────────────────────
 T2  Station A (상시 서빙)   Station B (실험)  ← 대형 모델·배치·파인튜닝. 외부 전송 X
      192GB VRAM             192GB VRAM
      ↑ LiteLLM 라우터 경유
 ─────────────────────────────────────────────
 T1  Mac Studio M3 Ultra 96GB                 ← [마이] 상시 허브 + 라우터 호스트
      ↑ Tailscale
 ─────────────────────────────────────────────
 T0  MacBook M3 Max 64GB                      ← 오프라인 자립. 단독으로 완결
```

**설계 원칙**: 위 계층이 죽어도 아래 계층만으로 일이 굴러가야 합니다.
스테이션이 꺼져도 Mac Studio가, Mac Studio가 없어도 MacBook이 [마이]를 유지합니다.

## 3. 모델 배치

**Qwen3.8-Flash-Next 검토 결과는 `QWEN38-NEXT.md` 에 별도 정리했습니다.**

| 계층 | 모델 | 상주 용량 | 근거 |
|---|---|---|---|
| **T0 MacBook 64GB** | Qwen3.8-27B abliterated MLX 4bit | ~15GB | 이동 중 자립. Flash-Next는 64GB에 안 들어감 |
| ↳ 여유분 | + 임베딩 모델 (BGE-M3 등) | ~2GB | 오프라인 로컬 RAG. 가성비 최고 |
| **T1 Mac Studio 96GB** | Qwen3.8-27B MLX 4bit — **상시** | ~15GB | [마이] 허브. 미덕은 크기가 아니라 즉응성 |
| ↳ 온디맨드 | **Qwen3.8-Flash-Next MLX-Serve 4bit** | **~70GB** | ⭐ 플릿에서 **이 기기만** 실행 가능 |
| **T2 Station A 192GB** | **Qwen3.8-27B AWQ ×8 replica** | GPU당 1개 | 실측 3090 1장 ~1,000 tok/s(64병렬) → **집계 ~8,000 tok/s** |
| ↳ 대기 | Flash-Next INT4 TP=4 ×2 | ~70GB | ⏳ 커뮤니티 quant 출시 대기 |
| **T2 Station B** | 파인튜닝(QLoRA) / 양자화 / 임베딩 인덱싱 | — | 서빙과 분리 |

> **Flash-Next를 T1에 상시 상주시키지 마세요.** 70GB를 잡으면 27B 상시 모델과
> LiteLLM 라우터가 같이 못 삽니다. 27B 상시 + Flash-Next 온디맨드가 정답입니다.

자세한 GPU 실무는 `GPU-STATIONS.md`, 메모리 튜닝은 `MODEL-NOTES.md` 참조.

## 4. 라우팅 정책 — 무엇을 어디로 보낼 것인가

이게 이 인프라의 실질적 가치입니다. 기준은 **난이도**가 아니라 **민감도 × 반복성**입니다.

| 작업 유형 | 대상 | 이유 |
|---|---|---|
| 아키텍처 설계, 난해한 디버깅, 리팩터링 | **Claude Code** | 프론티어 모델이 압도적. 아낄 이유 없음 |
| 대량 반복 코딩, 보일러플레이트 | **Codex** 또는 Station A | 건당 비용 의식할 구간 |
| IDE 내 자동완성·인라인 | **Antigravity** | 이미 구독 중 |
| [마이] 일상 대화·일정·메모 | **Mac Studio 로컬** | 지연 최소, 상시성 |
| 이동 중 모든 작업 | **MacBook 로컬** | 네트워크 무관 |
| **민감 데이터**(환자·개인정보·계약) | **Station A 전용** | 외부 전송 0. 이게 로컬 인프라의 존재 이유 |
| 무검열 응답이 필요한 작업 | **로컬 전용** | 클라우드로 보낼 이유가 없음 |
| 수천~수만 건 배치(분류·요약·라벨링) | **Station A** | 토큰 과금 없음. 밤새 돌리면 됨 |
| 파인튜닝, LoRA, 모델 평가 | **Station B** | |
| RAG 인덱싱(임베딩 수백만 건) | **Station B** → 인덱스만 T1/T0로 배포 | |

### 판단 규칙 3줄
1. **밖으로 나가면 안 되는 데이터인가?** → 예: 무조건 로컬(T0~T2).
2. **한 번뿐이고 어려운가?** → 예: Claude Code.
3. **쉽지만 만 번인가?** → 예: Station A.

## 5. 통합 엔드포인트 — LiteLLM 라우터

Mac Studio에 **LiteLLM 프록시 1개**를 띄워 모든 로컬 백엔드를 OpenAI 호환 API 하나로 통일합니다.
그러면 [마이]·스크립트·앱이 백엔드 위치를 몰라도 됩니다.

```
클라이언트 → http://macstudio:4000/v1
                 ├─ mai-fast    → Mac Studio 로컬 MLX (32B)
                 ├─ mai-local   → MacBook MLX 27B (맥북에서 실행 시)
                 ├─ mai-big     → Station A vLLM (235B-A22B)
                 └─ mai-batch   → Station A vLLM (32B ×2, 처리량 우선)
```

설정 예시는 `config/litellm.yaml` 에 있습니다.

> ⚠️ **Claude Code / Codex 는 이 라우터에 태우지 마세요.**
> `ANTHROPIC_BASE_URL` 을 바꾸면 구독 인증이 깨지고 API 종량과금으로 전환됩니다.
> 구독 도구는 그대로 두고, 라우터는 **로컬 스택 전용**으로 씁니다.

## 6. 네트워크

전 기기 **Tailscale** 단일 tailnet. 스테이션은 Linux이므로 `tailscale up --ssh` 로
SSH까지 tailnet 인증에 위임하면 키 관리가 사라집니다.

```
macbook ─┐
macstudio┼─ tailnet (WireGuard) ─┬─ station-a
         │                       └─ station-b
```

- 추론 서버는 전부 `127.0.0.1` 바인딩 + `tailscale serve` 로 tailnet 내부 공개.
- `tailscale funnel`(공용 인터넷 노출) **금지**.
- Mac Studio ↔ 스테이션 간 RAG 인덱스 전송이 잦다면 **10GbE 유선**을 별도로 깔고,
  Tailscale은 원격 접속용으로만 두는 것이 처리량에 유리합니다.

## 7. 지금 당장의 병목 2가지

### 7-1. Mac Studio 저장공간 — 외장 2TB로 해소됨
내장 1TB는 96GB 통합메모리에 비해 불균형했으나, **외장 2TB SSD 연결로 해결**되었습니다.

- 모델 아카이브를 외장으로: `export HF_HOME=/Volumes/<외장>/hf-cache`
- **다만 인터페이스 속도가 첫 로드 시간에 직결**됩니다(70GB 모델 기준 TB5 약 15초 vs
  USB 10Gbps 1분 이상). 통합메모리에 올라간 뒤에는 무관합니다.
- ⚠️ **상시 운영 중 외장 SSD를 뽑지 마세요.** mmap 참조 중이면 프로세스가 즉사합니다.

### 7-2. 전력과 발열
3090 ×16 = 최대 5.6kW. **사무실 일반 콘센트로는 불가능합니다.**
`GPU-STATIONS.md` 2절에 전용 회로·PSU 구성·전력제한 설정을 정리했습니다.
스테이션 구축 전에 반드시 먼저 읽으세요. 이게 프로젝트 전체의 실패 지점 1순위입니다.

## 8. 구축 순서

1. **Mac Studio 마이그레이션 완료 후 검증** — `brew doctor`, launchd 재등록, `01-inspect-mac.sh`
2. Tailscale 전 기기 연결 (맥 2대 먼저)
3. MacBook ↔ Mac Studio 동기화 궤도에 올리기 (`TWO-MACHINE.md`)
4. **전력·냉각 인프라 확보** ← 스테이션의 실제 전제조건
5. Station A 구축 → vLLM 상시 서빙
6. LiteLLM 라우터 기동 → [마이]가 T2를 쓰기 시작
7. Station B 구축 → 파인튜닝·인덱싱 파이프라인

# 전체 인프라 설계 — 5계층 플릿

> 이 문서가 최상위 설계입니다. `TWO-MACHINE.md` 는 맥 2대 동기화 실무만 다룹니다.

## 1. 하드웨어 인벤토리

| # | 기기 | 스펙 | 역할 | 상태 |
|---|---|---|---|---|
| M1 | **MacBook Pro** | M3 Max / 64GB / 2TB | 이동형 주개발 + [마이] 자립 노드 | 가동 |
| M2 | **Mac Studio** | M3 Ultra / 96GB / 1TB | 사무실 주개발 + [마이] 상시 허브 | 마이그레이션 중 |
| G1 | **Station A** | ROMED8-2T + EPYC 7542(32c) + RTX 3090 ×8 = **192GB VRAM** | 상시 추론 서빙 | 구축 |
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

| 계층 | 모델 | 4bit 용량 | 근거 |
|---|---|---|---|
| **T0 MacBook 64GB** | Qwen3 27B abliterated MLX 4bit (현재) | ~15GB | 상시 상주해도 49GB 여유. 이동 중 완전 자립 |
| ↳ 여유분 활용 | + Qwen3 30B-A3B 또는 임베딩 모델 병행 | ~18GB | 64GB면 2개 동시 상주 가능 |
| **T1 Mac Studio 96GB** | Llama 3.3 70B 또는 Qwen3 32B 4bit | 40GB / 18GB | 상시 대기. wired limit 상향 필요 |
| **T2 Station A 192GB** | **Qwen3 235B-A22B AWQ INT4** | ~120GB | MoE(활성 22B) — 8×3090에서 실용 속도가 나오는 최대급 |
| ↳ 동시 서빙 | Qwen3 32B AWQ ×2 replica | 각 ~20GB | 다중 동시 요청 처리량용 |
| **T2 Station B** | 파인튜닝(QLoRA 70B) / 양자화 / 임베딩 대량 인덱싱 | — | 서빙과 분리해 마음껏 재부팅 |

> **MacBook 64GB는 지금 과소 사용 중입니다.** 27B 4bit 하나면 15GB로, 절반도 안 씁니다.
> 임베딩 모델이나 30B-A3B를 함께 상주시켜 로컬 RAG를 붙일 여력이 충분합니다.

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

### 7-1. Mac Studio 1TB 저장공간
96GB 통합메모리에 1TB는 불균형합니다. 70B 4bit 하나가 40GB, 실험용 모델 몇 개면 금방 찹니다.

- **모델 원본은 Station B의 대용량 디스크에 보관**하고, Mac Studio에는 상주 모델 1~2개만 둡니다.
- 또는 Thunderbolt 5 외장 NVMe 4TB를 붙이고 `MAI_HOME` 을 그쪽으로 지정합니다
  (포터블 설계가 이미 이 경우를 지원합니다 — `ARCHITECTURE.md` 4절).

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

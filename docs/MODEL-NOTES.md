# 모델 배치 및 메모리 튜닝

전체 하드웨어 구성은 `FLEET.md`, GPU 실무는 `GPU-STATIONS.md` 참조.

## 1. 현재 운영 모델

| 기기 | 모델 | 포맷 | 용량 | 비고 |
|---|---|---|---|---|
| MacBook M3 Max 64GB | Qwen3 27B abliterated | MLX 4bit | ~15GB | [마이] 주 모델. 설치 완료 |
| Mac Studio M3 Ultra 96GB | 미정 (아래 권장안) | MLX 4bit | — | 마이그레이션 후 구성 |
| Station A ×8 3090 | 미정 | AWQ INT4 | — | 구축 후 |

> **참고**: Qwen3 공식 라인업은 0.6B / 1.7B / 4B / 8B / 14B / 32B / 30B-A3B / 235B-A22B 입니다.
> 27B는 공식 배포에 없으므로 커뮤니티 병합·프루닝 모델로 보입니다. 정확한 repo 이름을
> 알려주시면 컨텍스트 길이·토크나이저·권장 샘플링 파라미터를 맞춰 드리겠습니다.

## 2. Apple Silicon 메모리 튜닝

macOS는 GPU에 할당 가능한 wired 메모리를 기본적으로 전체의 약 75%로 제한합니다.
**통합메모리가 클수록 이 제한이 실질 병목이 됩니다.**

| 기기 | 총 RAM | 기본 wired 한도(약) | 권장 상향값 | 시스템 잔여 |
|---|---|---|---|---|
| MacBook M3 Max | 64GB | ~48GB | `57344` (56GB) | 8GB |
| Mac Studio M3 Ultra | 96GB | ~72GB | `86016` (84GB) | 12GB |

```bash
# MacBook 64GB — 56GB 까지 GPU 허용
sudo sysctl iogpu.wired_limit_mb=57344

# Mac Studio 96GB — 84GB 까지 GPU 허용
sudo sysctl iogpu.wired_limit_mb=86016

# 원복 (기본값)
sudo sysctl iogpu.wired_limit_mb=0
```

재부팅하면 초기화됩니다. 영구 적용이 필요하면 LaunchDaemon으로 등록하되,
**시스템 여유를 8GB 미만으로 남기지 마세요.** 커널 패닉과 강제 스왑이 발생합니다.

> 27B 4bit 하나(15GB)만 쓸 거라면 MacBook은 **이 설정이 불필요**합니다.
> 여러 모델을 동시 상주시키거나 컨텍스트를 크게 잡을 때만 손대세요.

## 3. MacBook 64GB 활용 제안

27B 4bit 상주 시 **49GB가 놀고 있습니다.** 이동 중 자립성을 더 끌어올릴 여지가 큽니다.

| 추가 상주 후보 | 용량 | 효과 |
|---|---|---|
| 임베딩 모델 (BGE-M3 등) | ~2GB | 오프라인 로컬 RAG 가능 — 이게 가장 가성비 높음 |
| Qwen3 30B-A3B 4bit | ~18GB | MoE. 27B보다 빠르면서 품질 유지. 용도별 전환 |
| 코딩 특화 소형 모델 | ~5GB | 자동완성 전용으로 분리 |
| 컨텍스트 확장 (32K → 128K) | KV 캐시 증가 | 긴 문서 처리 |

27B + 30B-A3B + 임베딩 = 약 35GB로, 64GB에서 **셋 다 동시 상주 가능**합니다.

## 4. Mac Studio M3 Ultra 96GB 권장 구성

96GB는 **70B급 4bit를 여유롭게 상주**시킬 수 있는 구간입니다.

| 선택지 | 용량 | 판단 |
|---|---|---|
| **Qwen3 32B 4bit** | ~18GB | ⭐ 상시 [마이] 허브용. 응답 빠르고 여유 많음 |
| Llama 3.3 70B 4bit | ~40GB | 품질 우선. 96GB에서 편안 |
| Qwen3 235B-A22B 4bit | ~120GB | ❌ 96GB에 안 들어감. Station A의 몫 |

**권장**: Mac Studio는 **32B 상시 + 70B 온디맨드** 2단으로 두고,
그보다 큰 건 전부 Station A로 넘깁니다. 상시 허브의 미덕은 크기가 아니라 **즉응성**입니다.

## 5. 양자화 포맷 — 플랫폼별 정답이 다릅니다

| 플랫폼 | 쓸 것 | 쓰지 말 것 |
|---|---|---|
| **Apple Silicon (MLX)** | MLX 4bit / 6bit | GGUF도 되지만 MLX가 대체로 더 빠름 |
| **Apple Silicon (llama.cpp)** | `Q4_K_M`, `Q5_K_M` | — |
| **RTX 3090 (Ampere)** | **AWQ INT4 (Marlin)**, GPTQ INT4, BF16 | ❌ FP8, MXFP4 — 네이티브 미지원 |

3090에서 FP8/MXFP4 모델을 시도하면 BF16으로 업캐스트되어 VRAM이 몇 배로 뜁니다.
`GPU-STATIONS.md` 1-2절 참조.

## 6. 모델 저장 위치 전략

Mac Studio가 **1TB**뿐이라 모델 원본을 다 둘 수 없습니다.

```
Station B (대용량 디스크)        ← 모든 모델 원본 아카이브
   ↓ 필요한 것만 배포
Mac Studio 1TB                   ← 상주 모델 1~2개 (약 60GB)
MacBook 2TB                      ← 이동용 모델 2~3개 (약 40GB)
```

또는 Mac Studio에 Thunderbolt 5 외장 NVMe 4TB를 붙이고 `MAI_HOME` 을 그쪽으로 지정합니다
(`ARCHITECTURE.md` 4절의 포터블 설계가 이 경우를 그대로 지원합니다).

## 7. 모델 지정

런타임·프롬프트와 모델은 분리되어 있습니다. `config/mai.env` 두 줄만 바꾸면 됩니다.

```bash
MAI_MODEL_ID="<허깅페이스 repo 또는 ollama 태그>"
MAI_MODEL_FILE="<GGUF 파일명 — MLX 사용 시 비움>"
```

어떤 파인튜닝/변형 가중치를 선택하든 세팅 구조는 그대로 재사용되며,
선택과 사용에 대한 책임은 로컬 운영자에게 있습니다.

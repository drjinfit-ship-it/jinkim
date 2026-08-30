# Qwen3.8-Flash-Next 배치 검토

조사일: 2026-08-30 (모델 공개 2026-08-26 — **공개 4일차**)

## 1. 모델 스펙

| 항목 | 값 |
|---|---|
| 정식 명칭 | `Qwen/Qwen3.8-Flash-Next` |
| 총 파라미터 | **125B** (51B N-gram 임베딩 테이블 + 4B MTP 모듈 포함) |
| **활성 파라미터** | **6B / 토큰** — 초희소 MoE |
| 레이어 | 48층 하이브리드 |
| 어텐션 | 4층 중 3층 **Gated DeltaNet**(선형, 히스토리 압축) + 1층 **Qwen Sparse Attention** |
| 컨텍스트 | 네이티브 **262,144** → 1M 확장 |
| 모달리티 | **멀티모달** (이미지·비디오 입력) |
| 위치 | Qwen4 아키텍처 프리뷰 |

**핵심**: 125B인데 활성 6B. 추론 비용은 6B급, 품질은 125B급입니다.
그리고 3/4 레이어가 선형 어텐션이라 **KV 캐시가 일반 모델보다 훨씬 작습니다** →
262K 컨텍스트가 메모리 제약 하에서도 실제로 쓸 만합니다.

## 2. 결론 먼저

> **Mac Studio M3 Ultra 96GB가 현재 이 모델을 돌릴 수 있는 유일한 기기입니다.**
> MacBook(64GB)은 용량 미달, GPU 스테이션(3090)은 쓸 수 있는 양자화가 아직 없습니다.

| 기기 | 가능? | 근거 |
|---|---|---|
| **Mac Studio M3 Ultra 96GB** | ✅ **가능 (단, 팩 선택 주의)** | MLX-Serve 4bit 팩 기준 상주 약 70GB |
| MacBook M3 Max 64GB | ❌ 불가 | 최소 70GB 필요 > 64GB |
| Station A/B (3090 ×8) | ⏳ **현재 불가** | 아래 4절 참조 |

## 3. Mac Studio — 어떤 팩을 받을 것인가 (가장 중요)

**같은 "4bit"라도 용량이 40GB 넘게 차이 납니다. 잘못 받으면 안 올라갑니다.**

| HF 리포 | 디스크 | 상주 메모리 | 96GB에서 |
|---|---|---|---|
| `Vontra/Qwen3.8-Flash-Next-MLX-4bit` | **112 GB** | 112GB+ | ❌ **받지 마세요** |
| `pipenetwork/...-MLX-mixed-4_8bit` | ~75GB급 | ~75GB | △ 매우 빠듯 |
| **`ddalcu/Qwen3.8-Flash-Next-MLX-Serve-4bit`** | — | **~70 GB** | ✅ **권장** |
| `ddalcu/...-MLX-Serve-mixed-4-8bit` | — | ~75 GB | △ 품질↑, 여유↓ |
| `labhraighlep/...-MLX-Serve-4bit` | — | ~70 GB | ✅ 대안 |

> `MLX-Serve` 팩이 51B N-gram 테이블을 지연 로딩/재양자화해 상주 메모리를 낮춘 빌드입니다.
> **반드시 `MLX-Serve` 가 이름에 들어간 팩**을 받으세요. 일반 `MLX-4bit`는 112GB입니다.
>
> 무검열 변형을 찾으신다면 `orcarouter/Qwen3.8-Flash-Next-Uncensored-MLX` 도 공개되어 있습니다.
> 어느 가중치를 쓸지는 운영자 판단이며, 아래 세팅 절차는 동일하게 적용됩니다.

### 3-1. 메모리 예산 — 빠듯합니다

```
총 통합메모리          96 GB
├─ 모델 상주          ~70 GB   (MLX-Serve 4bit)
├─ KV 캐시 + 활성화    ~8 GB   (선형 어텐션 덕에 이 정도로 끝남)
└─ 시스템 잔여        ~18 GB
```

wired limit을 반드시 올려야 합니다.

```bash
# Mac Studio 96GB — 88GB 까지 GPU wired 허용
sudo sysctl iogpu.wired_limit_mb=90112

# 확인
sysctl iogpu.wired_limit_mb
```

⚠️ **시스템 잔여가 8GB 아래로 떨어지면 커널 패닉**입니다. 90112(88GB)가 안전 상한선입니다.
재부팅하면 초기화되니 상시 운영하려면 LaunchDaemon으로 등록하세요.

### 3-2. 설치·실행

```bash
# 최신 mlx-lm / mlx-vlm (멀티모달을 쓰려면 mlx-vlm)
pip install -U mlx-lm mlx-vlm

# 모델은 외장 2TB SSD에 (내장 1TB를 아끼기 위해)
export HF_HOME=/Volumes/<외장SSD>/hf-cache

# 다운로드 + 실행
mlx_lm.generate \
  --model ddalcu/Qwen3.8-Flash-Next-MLX-Serve-4bit \
  --prompt "안녕, 마이." \
  --max-tokens 512

# OpenAI 호환 서버로 상시화 (LiteLLM이 여기에 붙습니다)
mlx_lm.server \
  --model ddalcu/Qwen3.8-Flash-Next-MLX-Serve-4bit \
  --host 127.0.0.1 --port 11434
```

### 3-3. 외장 SSD 주의점

외장 2TB에 두는 것은 맞는 선택입니다(내장 1TB에 70GB는 부담). 다만:

- **첫 로드 시간이 인터페이스 속도에 직결**됩니다. 70GB 기준:
  - Thunderbolt 5 (~6GB/s 실효) → 약 15초
  - Thunderbolt 3/4 (~2.5GB/s) → 약 30초
  - USB 10Gbps (~1GB/s) → **약 1분 이상**
- **한 번 통합메모리에 올라간 뒤에는 디스크 속도가 무관**합니다. 상시 상주시키면 문제 없습니다.
- 상시 운영 중 **외장 SSD를 뽑지 마세요.** MLX가 mmap으로 가중치를 참조하는 경우
  프로세스가 즉사합니다. 외장 상주 시 `MAI_HOME` 마운트 감시가 필요합니다.

## 4. GPU 스테이션 — 지금은 못 돌립니다

192GB VRAM이 있는데도 안 되는 이유가 명확합니다.

| 정밀도 | 용량 | 8×3090 (192GB) | 판정 |
|---|---|---|---|
| BF16 | ~250 GB | 초과 | ❌ |
| **FP8** (공식 배포) | ~125 GB | 용량은 되지만 | ❌ **Ampere에 FP8 텐서코어 없음** → BF16 업캐스트 → 250GB → 초과 |
| INT4 AWQ/GPTQ | ~62~70 GB | 여유 | ⏳ **공개 4일차, 커뮤니티 quant 미출시** |

**FP8 배포판이 있다고 3090에서 되는 게 아닙니다.** 이건 `GPU-STATIONS.md` 1-2절에서
이미 짚은 Ampere의 구조적 한계입니다.

### 대신 스테이션에서 지금 할 수 있는 것 — 이쪽이 더 실용적입니다

**Qwen3.8-27B AWQ INT4는 RTX 3090 한 장에 올라갑니다.** 실측 보고 기준:

| 조건 | 처리량 |
|---|---|
| 단일 사용자, 기본 샘플링, 64K 컨텍스트 | **~114 tok/s** |
| 150K 컨텍스트 | 95~100 tok/s |
| **64 병렬 요청 배치** | **~1,000 tok/s (집계)** |

→ **3090 8장 = 8 replica = 집계 약 8,000 tok/s.**
이건 Flash-Next 한 덩어리를 억지로 올리는 것보다 훨씬 가치 있는 구성입니다.
`FLEET.md` 라우팅 정책의 "쉽지만 만 번" 작업이 정확히 여기 해당합니다.

```bash
# GPU 1장당 1 replica — TP 불필요, 통신 병목 제로
for i in 0 1 2 3 4 5 6 7; do
  CUDA_VISIBLE_DEVICES=$i vllm serve <Qwen3.8-27B-AWQ-repo> \
    --quantization awq_marlin \
    --max-model-len 65536 \
    --gpu-memory-utilization 0.92 \
    --host 127.0.0.1 --port $((8000+i)) &
done
```

INT4 quant이 나오는 대로 Flash-Next를 TP=4 × 2 replica로 재검토합니다(6절).

## 5. NVLink 4-slot 브리지 ×4 — 어디에 쓸 것인가

### 사실 관계
- RTX 3090 NVLink는 **2장 페어링 전용**입니다. 브리지 1개 = GPU 2장.
- 브리지 4개 = **4개 페어 = GPU 8장 = 한 스테이션 전량**.
- 페어 내부는 P2P 정상 동작(약 112GB/s 양방향), **페어를 건너면 여전히 PCIe**입니다.

### 배치 판단

| 워크로드 | TP | NVLink 효과 |
|---|---|---|
| Qwen3.8-27B ×8 replica (4절) | TP=1 | **효과 없음** — 각 replica가 GPU 1장 |
| 70B급 AWQ | TP=2 | ✅ **최대 효과** — 페어 내부에서 완결 |
| Flash-Next INT4 (출시 후) | TP=4 | △ 부분 효과 — 페어 2개를 PCIe로 연결 |

**권장: 4개 전부 Station A에 장착.**
지금 주력인 27B ×8 replica 구성에서는 놀지만, TP=2 이상이 필요한 순간
(70B급 도입, Flash-Next INT4 출시) 즉시 값을 합니다. 나중에 옮기는 건 분해 작업입니다.

### ⚠️ 물리적 제약을 먼저 확인하세요
**4-slot 브리지는 두 GPU가 정확히 4슬롯 간격**이어야 합니다.
`GPU-STATIONS.md` 1-3절에서 짚었듯 8장은 이미 분기 라이저가 필요한 상황이라,
"라이저로 8장 배치"와 "4슬롯 간격 페어링"을 **동시에** 만족시키려면
오픈 프레임 + 라이저 길이 설계를 미리 도면으로 확인해야 합니다.
일반 케이스에 8장 + NVLink 4페어는 사실상 불가능합니다.

## 6. 최종 배치안

| 계층 | 모델 | 상태 |
|---|---|---|
| **T1 Mac Studio 96GB** | **Qwen3.8-Flash-Next MLX-Serve 4bit (~70GB)** | ✅ 지금 도입 — 온디맨드 |
| T1 Mac Studio (상시) | Qwen3.8-27B MLX 4bit (~15GB) | ✅ [마이] 상시 허브 |
| **T0 MacBook 64GB** | Qwen3.8-27B abliterated MLX 4bit | ✅ 현행 유지 (Flash-Next 불가) |
| **T2 Station A** | Qwen3.8-27B AWQ ×8 replica (~8,000 tok/s) | ✅ 스테이션 완성 시 |
| T2 Station A (장래) | Flash-Next INT4, TP=4 ×2 | ⏳ quant 출시 대기 |

### Mac Studio 상시 vs 온디맨드 — 판단이 필요합니다

Flash-Next를 **상시 상주**시키면 70GB를 잡아 **다른 모델을 동시에 못 올립니다.**
LiteLLM 라우터와 27B 상시 모델이 같이 못 삽니다.

**권장: 27B를 상시(~15GB), Flash-Next를 온디맨드.**
[마이] 허브의 미덕은 크기가 아니라 즉응성이고, 무거운 질의는 라우터가
Flash-Next 또는 Station A로 넘기면 됩니다. Station A가 가동되면 재검토하세요.

## 7. 신규 아키텍처 리스크

공개 4일차 모델입니다. 다음을 감안하세요.

- **llama.cpp / GGUF 미지원 가능성 높음.** Gated DeltaNet 계열은 역사적으로
  llama.cpp 지원이 수 주~수 개월 걸립니다. Ollama 경로를 기대하지 말고 **MLX로 가세요.**
- **INT4 커뮤니티 quant 미출시** — 스테이션 도입은 대기.
- MLX 팩마다 상주 메모리가 40GB 이상 차이 납니다. 반드시 3절 표를 확인하고 받으세요.
- 멀티모달(비전)까지 쓰려면 `mlx-vlm` 및 비전 타워 포함 팩이 필요합니다.

---

## 참고 자료

- [Qwen3.8-Flash-Next Preview: Release Date, Specs & Qwen4 — buildfastwithai](https://www.buildfastwithai.com/blogs/qwen3-8-flash-next-preview)
- [Alibaba's Qwen to open-source Qwen3.8-Flash-Next, previewing Qwen4 architecture — TechNode](https://technode.com/2026/08/26/alibabas-qwen-to-open-source-qwen3-8-flash-next-previewing-qwen4-architecture/)
- [Qwen3.8-Flash-Next 125B-A6B: MoE Drop Aug 26 — explainx.ai](https://www.explainx.ai/blog/qwen3-8-flash-next-125b-moe-release-august-2026)
- [Qwen/Qwen3.8-Flash-Next — vLLM Recipes](https://recipes.vllm.ai/Qwen/Qwen3.8-Flash-Next)
- [QwenLM/Qwen3.8-Flash-Next — GitHub](https://github.com/QwenLM/Qwen3.8-Flash-Next)
- [Vontra/Qwen3.8-Flash-Next-MLX-4bit — Hugging Face](https://huggingface.co/Vontra/Qwen3.8-Flash-Next-MLX-4bit)
- [ddalcu/Qwen3.8-Flash-Next-MLX-Serve-4bit — Hugging Face](https://huggingface.co/ddalcu/Qwen3.8-Flash-Next-MLX-Serve-4bit)
- [syv-ai/qwen38-27b-rtx3090 — 단일 3090 vLLM 실측 보고](https://github.com/syv-ai/qwen38-27b-rtx3090)
- [Qwen 3.8 27B Hardware Guide: From the RTX 3090 to the DGX Spark — Context Studios](https://www.contextstudios.ai/blog/qwen-3-8-27b-hardware-guide)
- [Running Qwen3.8-27B on Dual RTX 3090s: A vLLM Field Report](https://derekarmstrong.dev/blog/running-qwen38-27b-dual-rtx-3090-vllm-v026/)

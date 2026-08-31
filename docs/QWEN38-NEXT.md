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
| **Mac Studio M3 Ultra 96GB (28c/60c 바이닝)** | ✅ **가능, 여유 있음** | REAP-288 팩 기준 상주 **39GB** |
| MacBook M3 Max 64GB | △ REAP-288이면 가능 | 39GB < 64GB. 단 [마이] 27B와 동시 상주는 빠듯 |
| Station A/B (3090 ×8) | ⏳ **현재 불가** | 아래 4절 참조 |

## 3. Mac Studio — 어떤 팩을 받을 것인가 (가장 중요)

> **2026-08-30 정정**: 초판에서 `MLX-Serve 4bit(~70GB)`를 권장했으나, 추가 조사 결과
> **REAP 프루닝 팩과 MTPLX 팩이 더 우수**합니다. 또한 "메모리에 올라간 뒤 디스크 속도는
> 무관"이라고 썼던 것은 **틀렸습니다** — 3-3절 참조.

### 3-1. 팩 비교

| HF 리포 | 상주 메모리 | 디스크 | 품질 | 96GB에서 |
|---|---|---|---|---|
| `Vontra/...-MLX-4bit` | 112 GB | 112 GB | stock | ❌ **받지 마세요** |
| `ddalcu/...-MLX-Serve-4bit` | ~70 GB | — | stock | △ 되지만 여유 없음 |
| `pipenetwork/...-mixed-4_8bit` | ~75 GB | — | stock+ | △ 빠듯 |
| **`sh0wie/...-REAP-288-MLX-4bit`** | **39 GB** | 68 GB | HumanEval **91.5%** (stock 93.9%) | ✅ **1순위** |
| `sh0wie/...-REAP-384-MLX-4bit` | ~50GB급 | 80 GB | stock 대비 -1.8pt | ✅ 품질 우선 시 |
| **`Youssofal/...-MTPLX-Optimized-Speed`** | n-gram 스트리밍 | — | stock + **1.7× 속도** | ✅ **속도 우선 시** |
| `Youssofal/...-MTPLX-Bare-Speed` | 〃 | — | stock + 1.6× | ✅ |

### 3-2. REAP-288이 1순위인 이유

REAP(Router-weighted Expert Activation Pruning)로 **MoE 전문가를 512 → 288개로 가지치기**한
빌드입니다. 스톡 q4 대비 **60% 작고 상주 39GB**인데, HumanEval은 91.5% vs 93.9% —
**2.4포인트 손실로 용량을 60% 줄였습니다.**

96GB에서 39GB만 쓴다는 것의 의미:
- **[마이] 상시 27B(~15GB)와 Flash-Next를 동시에 상주**시킬 수 있습니다 (39+15=54GB).
- LiteLLM 라우터, 임베딩 모델까지 얹을 여유가 남습니다.
- 70GB짜리를 쓰면 이게 전부 불가능합니다. `FLEET.md` 6절의 "상시 vs 온디맨드" 고민이
  **REAP-288을 쓰면 아예 사라집니다.**

### 3-3. ⚠️ n-gram 테이블은 SSD에서 스트리밍됩니다 — 정정

MTPLX 계열 팩은 **32GB짜리 N-gram 임베딩 테이블을 메모리에 올리지 않고 SSD에서 스트리밍**합니다.
그래서 96GB Mac에 여유 있게 들어가는 것입니다. 가중치만 상주하고 테이블은 상주하지 않습니다.

**결과: 외장 SSD 속도가 첫 로드뿐 아니라 추론 내내 영향을 줍니다.**
초판에서 "메모리에 올라간 뒤에는 디스크 속도 무관"이라고 쓴 것은 이 팩들에는 해당되지 않습니다.

- 외장 2TB가 **Thunderbolt 4/5**인지 반드시 확인하세요. USB 10Gbps면 토큰 속도가 눌립니다.
- 가능하면 **n-gram 테이블은 내장 1TB SSD**에, 나머지 아카이브를 외장에 두는 편이 안전합니다.
- REAP 팩(디스크 68GB)은 내장 1TB에 충분히 들어갑니다.

### 3-4. wired limit

REAP-288(39GB) 기준이면 상향이 **불필요**합니다. 70GB급 팩을 쓸 때만 올리세요.

```bash
# 70GB급 팩을 쓸 경우에만
sudo sysctl iogpu.wired_limit_mb=90112   # 88GB, 안전 상한선
```

### 3-5. 설치·실행

```bash
pip install -U mlx-lm mlx-vlm

# 모델 캐시 위치 — n-gram 스트리밍을 감안해 가급적 내장 SSD
export HF_HOME=~/hf-cache          # 또는 TB4/5 외장

mlx_lm.server \
  --model sh0wie/Qwen3.8-Flash-Next-REAP-288-MLX-4bit \
  --host 127.0.0.1 --port 11434
```

MTPLX 팩은 자체 서버(`mtplx serve`)를 씁니다 — [MTPLX 리포](https://github.com/youssofal/MTPLX) 참조.

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

## 6. 27B와 무엇이 다른가 — 벤치마크와 근거

### 6-1. 공식 벤치마크: Flash-Next가 18개 전 항목 승

두 모델 모두 공개된 18개 벤치마크에서 **Flash-Next가 전부 이겼습니다.**
(Agents' Last Exam, AndroidWorld, CharXiv-R, ClawEval-MM, CoWorkBench, DeepSWE 1.1,
ERQA, GPQA, HLE, IFBench, Job Bench, LiveCodeBench v6, MathVision, NL2Repo,
RealWorldQA, RecreationBench, SWE-Bench Pro, Vision2Web)

| 항목 | Qwen3.8-27B | Flash-Next | 차이 |
|---|---|---|---|
| MathVision | 94.6% | 95.7% | **+1.1** |
| LiveCodeBench v6 | 90.3% | 91.9% | **+1.6** |
| GPQA | 89.2% | 91.7% | **+2.5** |

**그런데 차이가 1~2.5 포인트입니다.** 파라미터가 4.6배(27B→125B)인데 벤치마크는
2포인트 남짓 오릅니다. 이게 이 모델을 이해하는 핵심입니다.

### 6-2. ⚠️ 숫자의 신뢰도가 대칭이 아닙니다

**Flash-Next 수치는 전부 알리바바 자체 발표이며 제3자 재현이 없습니다.**
반면 27B는 독립 검증 결과가 있습니다 — 휴먼 프리퍼런스 아레나 순위,
제3자 처리량 실측 등. 프리뷰 모델은 이걸 갖고 있지 않습니다.

사전학습 벤치마크(Base 모델)를 보면 그림이 더 정직합니다:
**Flash-Next-Base는 14개 중 8개만 이깁니다.** 즉 6개는 27B가 앞섭니다.
"전 항목 승"은 사후학습(instruct) 단계 수치이고, 원시 능력 격차는 그보다 작습니다.

### 6-3. 유저 평가 — 표본이 매우 얇습니다

공개 4일차라 커뮤니티 반응은 아직 형성 중입니다. 확인된 것:

- **SGLang이 day-0 지원**, vLLM도 공식 레시피 제공 → 인프라 채택은 빠름
- **llama.cpp 지원 요청 이슈만 등록된 상태**(#27741) — GGUF 경로는 아직 없음
- MLX 커뮤니티가 가장 빠르게 움직여 REAP 프루닝, MTPLX 등 파생 빌드 다수 등장
- 가격 경쟁력 보고: **SWE-bench Pro 62.5 vs DeepSeek V4 Pro 55.4, $0.15/M 토큰**
- **부정적 품질 보고는 아직 눈에 띄지 않음** — 다만 이건 "좋다"가 아니라
  "판단할 표본이 없다"에 가깝습니다.

### 6-4. ⚠️ 정정 — Qwen3.8-27B의 구조를 잘못 알고 있었습니다

초판에서 27B를 "밀집 표준 어텐션 · 텍스트 전용"으로 전제했는데 **틀렸습니다.**
확인된 실제 구조:

| | Qwen3.8-27B | Flash-Next |
|---|---|---|
| 파라미터 | 27.78B **dense** | 125B MoE (활성 6B) |
| **어텐션** | **64층 중 48층 Gated DeltaNet(선형) + 16층 full** | 48층 중 36층 선형 + 12층 sparse |
| **컨텍스트** | **262,144 네이티브 → 1M (YaRN)** | 262,144 → 1M |
| **멀티모달** | **네이티브 VLM — 이미지·다이어그램·문서·시간 단위 비디오** | 이미지·비디오 |

**즉 Flash-Next의 차별점이라고 봤던 두 축이 27B에도 그대로 있습니다.**

초판 6-4절에서 다음 두 항목은 **철회합니다**:
- ~~"긴 컨텍스트 — Flash-Next 압도. 27B는 밀집이라 KV가 컨텍스트에 비례 증가"~~
  → 27B도 **48/64층이 선형 어텐션**이라 KV가 상수 상태로 압축됩니다. 컨텍스트도 동일한 262K.
- ~~"멀티모달 — Flash-Next만 가능. 27B는 텍스트"~~
  → 27B는 **네이티브 비전-언어 모델**입니다.

Qwen3-Next가 도입한 하이브리드 Gated DeltaNet 구조가 Qwen3.5~3.8 전 계열에
재사용되었기 때문입니다. 27B는 그 구조를 물려받은 dense 모델입니다.

### 6-4b. 남은 실제 차이

| 축 | 판단 | 근거 |
|---|---|---|
| 일반 대화·지식 | **체감 차이 작음** | 벤치 격차 1~2.5pt. Base는 6개 항목에서 27B 우세 |
| **에이전트/툴 사용** | Flash-Next 소폭 우위 | 우위 항목이 Agents' Last Exam, AndroidWorld, DeepSWE, SWE-Bench Pro에 몰림 |
| 정형 패턴·코드 관용구 | Flash-Next 유리 | 51B N-gram 로컬 패턴 메모리 |
| 긴 컨텍스트 | **동급** | 둘 다 하이브리드 선형 어텐션, 262K |
| 멀티모달 | **동급** | 둘 다 네이티브 VLM |
| **응답 안정성** | **27B 우위** | 독립 검증·아레나 실적 보유 vs 공개 4일차 프리뷰 |
| **이 맥에서의 속도** | **27B 유리** | 6-5절 — 바이닝된 60코어가 MoE를 때림 |

**수정된 한 줄 요약**: 아키텍처 세대가 같고 컨텍스트·멀티모달도 같습니다.
**남는 건 벤치 1~2.5pt와 에이전트 성향뿐이며, 그 수치는 자체 발표이고 재현되지 않았습니다.**

## 6-5. Mac Studio 토큰 속도 예상

### 전제: 이 맥 스튜디오는 28코어/60코어 바이닝 버전입니다

이게 **일반적인 직관과 반대로 중요합니다.**

- 메모리 대역폭은 바이닝과 무관 — **약 800GB/s 그대로**입니다.
- **GPU 코어는 60/80 = 75%** 입니다.
- 그리고 **초희소 MoE에서는 대역폭이 아니라 GPU 연산·메모리 레이턴시가 병목**입니다.

결정적 근거: 실측 보고에서 **Qwen3-Next-80B(3B 활성) 기준 M4 Pro 52.3 tok/s가
M3 Ultra 49.1 tok/s를 앞섰습니다.** 대역폭이 3배인 Ultra가 진 겁니다.
MoE는 파라미터를 전부 읽지 않아 대역폭 병목이 먼저 풀리고, 그 다음엔 연산 효율과
접근 레이턴시가 좌우하기 때문입니다.

→ **Ultra의 800GB/s 강점이 이 모델에서는 대부분 낭비됩니다.
   그리고 바이닝으로 깎인 GPU 코어는 정확히 병목 지점을 때립니다.**

### 추정 계산

| 앵커 | 값 | 출처 |
|---|---|---|
| Qwen3-Next-80B (3B 활성) on M3 Ultra | 49.1 tok/s | 실측 보고 |
| Qwen 3.5 35B-A3B MLX 8bit on M3 Ultra 512GB | 80+ tok/s | 실측 보고 |
| MTPLX 투기적 디코딩 배수 (Flash-Next) | **1.6~1.7×** | M5 Max 실측 |
| MTP 수용률 | D3에서 ~32%로 감쇠 | MTPLX 문서 |

Flash-Next는 **활성 6B로 Qwen3-Next-A3B의 2배**입니다. 다만 3/4 레이어가 선형
어텐션이라 선형 비례로 절반이 되지는 않습니다.

```
기준점        Qwen3-Next-80B-A3B on M3 Ultra        ≈ 49 tok/s
활성 2배      6B/3B, 선형 어텐션 보정               × 0.55~0.7   → 27~34
바이닝 60코어 연산 병목 구간이라 직격              × 0.8~0.9    → 22~31
REAP-288      전문가 512→288, 메모리 트래픽 감소   × 1.15~1.35  → 25~42
MTP 투기 디코딩                                     × 1.6~1.7    → 40~70
```

### 결론

| 구성 | 예상 tok/s (단일 스트림) |
|---|---|
| 스톡 4bit, MTP 없음 | **20~30** |
| REAP-288 4bit, MTP 없음 | **25~40** |
| **REAP-288 + MTPLX (권장)** | **40~65** |
| MTPLX-Optimized-Speed (스톡 품질) | **35~55** |

**중앙값 기대치는 REAP-288 + MTP 조합에서 약 45~55 tok/s** 입니다.
읽는 속도(사람이 편하게 따라가는 속도가 대략 10~15 tok/s)의 3~4배이므로
대화형으로는 충분히 쾌적합니다.

### 이 추정을 빗나가게 할 요인

1. **외장 SSD 인터페이스** — n-gram 테이블이 스트리밍되므로(3-3절),
   USB 10Gbps면 여기서 크게 깎입니다. **TB4/5 확인이 최우선.**
2. **컨텍스트 길이** — 선형 어텐션 덕에 감쇠가 완만하지만 0은 아닙니다.
3. **MTP 수용률** — 코드처럼 예측 가능한 텍스트는 배수가 잘 나오고,
   창의적 텍스트는 낮습니다. 1.6×는 상한에 가깝습니다.
4. **M5 Max 기준 배수를 M3 Ultra에 적용한 것** — 세대가 달라 오차 요인입니다.

**실측이 최선입니다.** 아래로 30분이면 확인됩니다.

```bash
mlx_lm.generate --model sh0wie/Qwen3.8-Flash-Next-REAP-288-MLX-4bit \
  --prompt "파이썬으로 이진탐색 트리를 구현하고 설명해줘" \
  --max-tokens 1024 --verbose
# 출력 끝에 generation tok/s 가 찍힙니다
```

## 6-6. 판단 — Mac Studio는 27B 단독으로 간다

**결론: 27B 상시 단독. Flash-Next는 디스크에 두고 A/B 후 결정.**

### 근거

1. **아키텍처 이점이 동일합니다** (6-4절). 롱컨텍스트·멀티모달이 Flash-Next 전유물이 아닙니다.
2. **이 하드웨어가 27B를 편듭니다.** 28c/60c 바이닝 M3 Ultra는 **대역폭(800GB/s)은 온전한데
   GPU 코어가 25% 깎였습니다.** dense 27B는 대역폭을 쓰고, Flash-Next의 초희소 MoE는
   연산·레이턴시에 의존합니다. 깎인 쪽이 정확히 MoE의 병목입니다.
3. **남는 차이는 벤치 1~2.5pt** — 자체 발표, 제3자 미재현. 프롬프트 개선으로 뒤집히는 폭입니다.
4. **메모리 81GB가 열립니다.** 15GB만 쓰면:
   - **27B 인스턴스를 2~3개 병렬 상주** → 파이프라인 추출 처리량이 오히려 증가
   - 임베딩 + 리랭커 상주 → 로컬 RAG
   - Whisper·pyannote와 여유롭게 공존
5. **맥북과 같은 모델**이 됩니다. abliterated MLX 빌드가 이미 검증되어 있고,
   프롬프트를 한 벌만 관리하면 됩니다. 두 기기의 동작이 일치합니다.
6. **디스크 15GB vs 68GB.**

### ⚠️ 단, 런타임을 반드시 확인하세요 — 4배 차이입니다

| 런타임 | Qwen3.8-27B 속도 |
|---|---|
| **Ollama (M3 Ultra 실측)** | **~14 tok/s** ❌ |
| oMLX + native MTP (M4 Max 실측) | **48~65 tok/s** ✅ |

Ollama의 Metal 커널이 새 하이브리드 어텐션을 아직 못 따라잡았습니다
(같은 기계에서 구세대 Qwen3.6-27B는 28.6 tok/s). **Ollama로 쓰면 안 됩니다.**
`oMLX` 또는 MTP 투기적 디코딩을 붙인 MLX 경로로 가세요.

참고로 Qwen3.8은 같은 질문에 약 1,000토큰으로 답하고 3.6은 2,000~3,300토큰을 쓰므로,
**완성 답변 기준 체감 시간은 tok/s 차이보다 작습니다.**

### Flash-Next를 남겨둘 이유

디스크 68GB는 3TB에서 부담이 아닙니다. 지워야 할 이유가 없습니다.

- **에이전트 워크로드에서만 A/B**: 파이프라인 5단계(자동 실행)는 툴 사용이 많고,
  Flash-Next의 우위가 몰려 있는 영역입니다. 실제 업무 프롬프트로 비교해 보세요.
- 27B(15GB) + Flash-Next(39GB) = 54GB이므로 **필요할 때 27B를 내리지 않고도 동시에 올릴 수 있습니다.**
- 판단은 벤치가 아니라 **본인 업무 프롬프트에서의 채택률**로 하세요.

### 최종 배치

| 계층 | 모델 | 상주 | 상태 |
|---|---|---|---|
| **T1 Mac Studio 96GB** | **Qwen3.8-27B MLX 4bit ×2~3 인스턴스** | 30~45GB | ✅ **상시 단독** |
| T1 (온디맨드) | Flash-Next REAP-288 | 39GB | 에이전트 A/B용 |
| T1 (상주) | 임베딩 + 리랭커 | ~3GB | 로컬 RAG |
| **T0 MacBook 64GB** | Qwen3.8-27B abliterated MLX 4bit | 15GB | ✅ 동일 모델 |
| **T2 Station A** | Qwen3.8-27B AWQ ×8 replica | — | 집계 ~8,000 tok/s |

**전 계층이 같은 모델(27B)로 통일됩니다.** 프롬프트 한 벌, 동작 일관성,
어느 계층으로 라우팅되든 같은 성격의 답. 운영 복잡도가 크게 내려갑니다.

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
- [Qwen3.8-27B Explained: Hybrid Attention, 262K Context — MindStudio](https://www.mindstudio.ai/blog/qwen3-8-27b-architecture-benchmarks)
- [Qwen/Qwen3.8-27B — 27B · DENSE · 256K ctx — vLLM Recipes](https://recipes.vllm.ai/Qwen/Qwen3.8-27B)
- [Qwen3.8-27B Turns a Desktop-Sized Model Into an Agent — NxCode](https://www.nxcode.io/resources/news/qwen3-8-27b-local-agent-model-2026)
- [Weschera/Qwen3.8-27B-oMLX-MTP-Mac — 48~65 tok/s 실측](https://github.com/Weschera/Qwen3.8-27B-oMLX-MTP-Mac)
- [Run Qwen3.8 27B locally: real numbers from my Mac Studio — TerminalBytes](https://terminalbytes.com/run-qwen-3-8-27b-locally/)
- [Qwen3.8 27B on a Mac Studio: 14 tok/s, but faster per answer — Zeli](https://zeli.app/story/49479951)
- [Qwen3.8-27B vs Qwen3.8-Flash-Next: Benchmarks, Pricing & Which Is Better — llm-stats](https://llm-stats.com/models/compare/qwen3.8-27b-vs-qwen3.8-flash-next)
- [Qwen3.8-Flash-Next vs Qwen3.8-27B: which open Qwen to run? — orcarouter](https://www.orcarouter.ai/blog/qwen-3-8-next-vs-qwen-3-8)
- [Qwen3.8 Flash Next Review: Benchmarks, Architecture, Memory — The Kaitchup](https://kaitchup.substack.com/p/qwen38-flash-next-review-benchmarks)
- [Qwen3.8-Flash-Next: Day-0 Support in SGLang — LMSYS](https://www.lmsys.org/blog/2026-08-26-qwen-flash-next)
- [Feature Request: Qwen3.8-Flash-Next support — llama.cpp #27741](https://github.com/ggml-org/llama.cpp/issues/27741)
- [sh0wie/Qwen3.8-Flash-Next-REAP-288-MLX-4bit — Hugging Face](https://huggingface.co/sh0wie/Qwen3.8-Flash-Next-REAP-288-MLX-4bit)
- [youssofal/MTPLX — Native MTP Speculative Decoding on Apple Silicon](https://github.com/youssofal/MTPLX)
- [Youssofal/Qwen3.8-Flash-Next-MTPLX-Optimized-Speed — Hugging Face](https://huggingface.co/Youssofal/Qwen3.8-Flash-Next-MTPLX-Optimized-Speed)
- [Silicon Showdown: Consumer-Grade LLM Inference — arXiv](https://arxiv.org/pdf/2605.00519)
- [Systematic inference benchmarks on M3 Ultra — mlx discussion #3209](https://github.com/ml-explore/mlx/discussions/3209)
- [Mac Studio M3 Ultra 96GB 28/60 LLM Performance — MacRumors](https://forums.macrumors.com/threads/mac-studio-m3-ultra-96gb-28-60-llm-performance.2456559/)

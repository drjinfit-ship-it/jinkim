# Qwen3.8-27B 무검열 모델 · RTX 3090 최적 운용 플레이북 (2026-09-02)

원칙: **만들지 않고 찾는다.** 아래는 전부 이미 공개된 체크포인트·엔진·레시피이며, 직접 어블리터레이션이나
양자화를 새로 만들 필요가 없는 조합만 추렸다.

> 검증 범위 고지: 이 세션에서 huggingface.co 직접 접근은 차단되어 있었다. 모델 카드 수치(거부율, KL,
> MMLU 등)는 검색 스니펫과 GitHub 문서로 교차 확인한 **업로더 자기보고 값**이다. 다운로드 전에 각
> 모델 카드에서 한 번 더 확인할 것.

---

## 0. 결론

| 목적 | 추천 조합 | 근거 |
|---|---|---|
| **가장 단순·안전한 무검열 1인 사용** | llama.cpp 최신 master + MTP 헤드가 보존된 무검열 GGUF (hotdogs 또는 HauhauCS) + `--spec-type draft-mtp` | 3090에서 31.0 → 41.3 tok/s(+33%), 131K 컨텍스트, 변환 작업 0 |
| **속도·동시성 최우선** | syv-ai/qwen38-27b-rtx3090 (패치된 vLLM 0.27.1) + `leminkozey/Qwen3.8-27B-Uncensored-W4A16-AutoRound` | C1 약 114 tok/s, 64 동시 약 1,000 tok/s, 150k~262k 컨텍스트, 무검열 체크포인트 공식 지원 |
| **최대 컨텍스트·최고 단일 속도 (검열 모델 한정)** | NInfer-3090 + 공식 `.ninfer` 아티팩트 (+ PR #16 `rk8v4`) | INT8 171K → rk8v4 226K 컨텍스트, C1 MTP3 약 70~82 tok/s. 단, 무검열 아티팩트는 아직 없음 |

핵심 주의 2가지:
1. **Thinking 모드는 무검열 효과를 되돌릴 수 있다.** 어블리터레이션은 가중치의 거부 방향을 제거하지만
   모델이 사고 과정에서 거부를 다시 도출하는 사례가 보고되어 있다. 무검열 용도라면 thinking을 끄거나
   `reasoning_effort=low`로 시작한다.
2. **Qwen3.8의 기본 reasoning_effort는 `xhigh`**라서 "생각이 끝나지 않는" 문제가 흔하다. llama-server에서는
   `--jinja --reasoning-effort medium`(또는 low)으로 낮춘다. Ollama는 모델 템플릿을 자체 템플릿으로
   덮어써서 이 설정이 동작하지 않는다.

---

## 1. 모델 기본 사실 (Qwen/Qwen3.8-27B)

| 항목 | 값 |
|---|---|
| 공개 | 2026-08-14, Apache 2.0 |
| 구조 | 27B dense 하이브리드. 64 레이어 = 16 × (Gated DeltaNet 3 + Gated Attention 1). Attention은 GQA 24/4, head_dim 256. hidden 5120, FFN 17,408 |
| 컨텍스트 | 네이티브 262,144, YaRN으로 1M 확장 |
| 부가 | 비전 인코더 내장, **MTP(NextN) 헤드 내장** (speculative decoding 용) |
| 사고 제어 | thinking 기본 ON, `reasoning_effort` = low / medium / xhigh (기본 xhigh), `preserve_thinking` 기본 ON |

공식 권장 샘플링 (모델 카드 기준, 검색 스니펫으로 확인):

| 모드 | temperature | top_p | top_k | min_p | presence_penalty | repetition_penalty |
|---|---|---|---|---|---|---|
| Thinking | 1.0 | 0.95 | 20 | 0.0 | 0.0 | 1.0 |
| Instruct(non-thinking) 일반 | 0.7 | 0.8 | 20 | 0.0 | 1.5 | 1.0 |

`presence_penalty`는 0~2 사이에서 반복 억제용으로 조절하되, 높이면 언어 혼합이 생길 수 있다.

---

## 2. 공개된 무검열(abliterated) 변종 목록

| 변종 (HF repo) | 방식 | 자기보고 지표 | 형식 | MTP 헤드 | 비고 |
|---|---|---|---|---|---|
| `huihui-ai/Huihui-Qwen3.8-27B-abliterated` (+`-GGUF`) | 어블리터레이션, **18~51층만 제거**해 성능 보존 | 수치 미확인 | safetensors, GGUF | 미확인 | 2026-08-18. 가장 널리 알려진 계열 |
| `orcarouter/Qwen3.8-27B-Uncensored` (+`-FP8`, `-GGUF`, Ollama) | 어블리터레이션 | 미확인. 권장 설정: temp 0, rep 1.15, 시스템 프롬프트 없음, **thinking OFF** | BF16, FP8(vLLM, 262K, MTP), GGUF 2~16bit | FP8 빌드는 MTP 지원 명시 | 2026-08-16 |
| `leminkozey/Qwen3.8-27B-Uncensored-W4A16-AutoRound` | orcarouter 계열 + AutoRound W4A16 + head 재양자화 | — | vLLM 즉시 서빙 | — | **syv-ai 3090 스택이 "준비 없이 바로 서빙"으로 명시** |
| `hotdogs/Qwen3.8-27B-abliterated` (+`-MTP-GGUF`, `twolven/...-AWQ-MTP`) | 학습 없는 어블리터레이션 | 미확인 | safetensors, GGUF, AWQ W4A16 | **GGUF/AWQ 모두 MTP 보존 명시** | llama.cpp MTP 조합 1순위 후보 |
| `HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF` (+`twolven/...-AWQ-MTP`) | "Aggressive" 프로파일 | **0/465 거부** | GGUF 전 라인업, AWQ | **NextN 보존 + FastMTP 사이드카** | 텍스트·비전·비디오 능력 유지 주장 |
| `OBLITERATUS/Qwen3.8-27B-OBLITERATED` (V2/V3) | SVD 기반 + LEACE 기반 수술을 **블렌딩** | V2: 거부 0%, **MMLU 86.3 vs 원본 85.3** | GGUF, safetensors, MLX | 미확인 | 12만+ 다운로드. V3 템플릿은 빈 thinking 블록을 프리필해 바로 답변 |
| `0bserverx/Qwen3.8-27B-Heretic-Abliterated-Uncensored-GGUF`, `JonathanColetti/Qwen3.8-27B-Uncensored-GGUF`, `MuXodious/Qwen3.8-27B-absolute-heresy`, `asfgsdfg/Qwen3.8-27B-Heretic` | **Heretic**(p-e-w, v1.4.0) — 거부 수와 KL 발산을 동시 최소화 | 사례: 거부 98%→39%에 KL 0.0001 / 정제판 KL≈0.0085에 거부 0~1/100 | GGUF, safetensors | 미확인 | Heretic은 "거부 완전 제거"가 아니라 "KL 대비 최적점" 지향 |
| 일본 커뮤니티 EXL3 `Qwen3.8-27b-abliterated-3.69bpw-12GB-MTP` | 어블리터레이션 + EXL3 3.69bpw | 11.7GB, 16GB 카드에서 최대 39 tok/s | EXL3 | 있음 | 12GB로 줄여 24GB 카드엔 여유가 과함. 일본어 정확도 유지 주장 |

선택 기준:
- **거부율 최소 + 속도**: HauhauCS Aggressive MTP-GGUF (0/465) 또는 OBLITERATUS V2/V3.
- **원본 지능 보존 우선**: Heretic 계열(KL 최소화) 또는 huihui(부분 레이어).
- **vLLM 3090 스택과 궁합**: leminkozey AutoRound(orcarouter 계열) 또는 twolven AWQ-MTP.

---

## 3. RTX 3090에서 돌릴 수 있는 공개 스택 비교

| 스택 | 입력 형식 | 3090 실측 | 무검열 지원 | 컨텍스트 | 난이도 |
|---|---|---|---|---|---|
| **llama.cpp (master, MTP)** | GGUF (nextn 텐서 포함) | Q4_K_M, 131K ctx, KV q4_0: **31.0 → 41.3 tok/s** (+33%, 수용률 0.78). 일부 설정 +45~49%. 베이스라인 4K ctx 약 40 tok/s | O (GGUF면 무엇이든) | 128K~ | 낮음 |
| **syv-ai/qwen38-27b-rtx3090** (vLLM 0.27.1 패치, Docker) | AutoRound W4A16 / 스트리밍 재양자화 | **C1 약 114 tok/s**(greedy 120~124, DFlash2 126~133), **64 동시 약 1,000 tok/s**. IFBench 78.3, GSM8K 96.5 | **O, 문서에 abliterated 지원 명시** | 150k(int8 KV)~262k | 중간 (Docker compose 제공) |
| **NInfer-3090** (Don-Chad 포크) | `.ninfer` 공식 아티팩트만 | C1 70~71 tok/s(MTP3), C8 합계 161 tok/s, INT8 171,648 tok. 제3자 보고 65.6@8K / 43.1@128K | **X** (공식 아티팩트만 배포. 변환 도구는 있으나 "만들기" 영역) | 171K (INT8) / 226K (PR #16 rk8v4) | 낮음(Windows 배포) |
| **ExLlamaV3 + TabbyAPI** | EXL3 (Honkware 3.8bpw, MiaAI DFlash2 킷 등) | 약 100 tok/s 급 보고, MiaAI 킷은 커스텀 exllamav3 포크 필요 | O (EXL3 무검열 3.69bpw 존재) | 220k~262k (KV 4bit) | 중간 |
| Ollama (`orcarouter/Qwen3.8-27B-Uncensored`) | 17.7GB (16.8 + 비전 0.9) | 미측정 | O | — | 가장 낮음. **단 reasoning_effort 제어 불가** |

---

## 4. 권장 레시피 (복사해서 쓰는 순서)

### 4-A. 1순위: llama.cpp + 무검열 MTP-GGUF

```bash
# 최신 master 빌드 필수 (MTP: PR #22673, 2026-05 머지; 플래그명은 --spec-type draft-mtp)
llama-server \
  -m Qwen3.8-27B-<uncensored>-Q4_K_M.gguf \
  -c 131072 -ngl 999 -fa 1 \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --spec-type draft-mtp --spec-draft-n-max 2 --parallel 1 \
  --jinja --reasoning-effort low \
  --temp 0.7 --top-p 0.8 --top-k 20 --min-p 0 --presence-penalty 1.5
```

- KV를 q4_0/q4_0으로 내리면 131K에서 위 실측(41.3 tok/s)이 재현되고, q8_0은 품질 우선 안전값이다.
- MTP는 `--parallel 1`에서만 이득. 동시 4 스트림이면 이득이 사라진다. 짧은 응답(400토큰 이하)은 이득이 작다.
- 무검열 목적이면 thinking OFF(`enable_thinking=false` 또는 `reasoning_effort=low`)로 먼저 테스트.
  orcarouter 권장(temp 0, rep 1.15)과 공식 instruct 프리셋(0.7/0.8/20/presence 1.5)을 둘 다 비교해 본다.
- GGUF 선택: `hotdogs/...-MTP-GGUF` 또는 `HauhauCS/...-Aggressive-MTP-GGUF`. `blk.*.nextn.*` 텐서가 없는
  GGUF는 MTP 플래그가 무시된다(huihui GGUF는 포함 여부 미확인 → 모델 카드 확인).

### 4-B. 2순위: syv-ai vLLM 스택 + AutoRound 무검열

```bash
git clone https://github.com/syv-ai/qwen38-27b-rtx3090
# 모델을 leminkozey/Qwen3.8-27B-Uncensored-W4A16-AutoRound 로 지정 (README의 third-party checkpoint 절)
docker compose --profile single up -d     # 1인용, ~114 tok/s
docker compose --profile batch  up -d     # 다중 사용자, 64 동시 ~1,000 tok/s
# 주요 환경변수: SPEC=dflash2 (+7~10 tok/s), PREFIX_CACHE=1 (멀티턴 필수), CTX=long (int8 KV, 150k)
```

- 참고 vLLM 단독 실행 예(커뮤니티): `vllm serve <W4A16-AutoRound> --quantization auto-round --max-model-len 8192 --gpu-memory-utilization 0.95 --kv-cache-dtype fp8 --reasoning-parser qwen3`
- WSL2에서 DFlash2는 `VLLM_WSL2_ENABLE_PIN_MEMORY=1` 필요.

### 4-C. NInfer-3090 (검열 원본 모델로 최대 컨텍스트가 필요할 때)

- 공식 아티팩트 `neroued/Qwen3.8-27B-NInfer` (16.96 GiB, 1,118 텐서)만 지원.
- `--kv-dtype int8`로 171,648 토큰. **PR #16**(ashalliants, 2026-09-01 기준 open)이 머지되면
  `--kv-dtype rk8v4`로 226,560 토큰(+32%)이 되며 대가는 perplexity +0.082%, MTP3 디코드 −5.2%
  (81.61 → 77.39 tok/s, 드래프트 수용률 71.27% → 65.86%).
- 무검열로 쓰려면 `tools/convert/qwen3_8_27b/convert.py --model <abliterated safetensors dir>` 변환이 필요하다.
  변환기는 tokenizer/chat_template 등 프론트엔드 파일의 SHA-256을 **공식 값과 일치**하도록 강제하므로
  템플릿을 바꾼 변종(예: OBLITERATUS V3)은 실패하고, 템플릿을 건드리지 않은 변종(huihui, hotdogs 등)은
  통과 가능성이 있으나 **미검증**이다. 이 경로는 "만들기"에 해당하므로 후순위.
- 저장소 이슈에 무검열/커스텀 변환 요청은 아직 없다(2026-09-02 확인).

---

## 5. PR #16 (Don-Chad/ninfer-3090) 요약

| 항목 | 값 |
|---|---|
| 제목 | Port RotorQuant rk8v4 onto the kv_cache_append Op (32% more context for 0.082% perplexity) |
| 상태 | Open (커밋 5개, 2026-08-29 ~ 09-01), 변경 33파일 +1,302/−376 |
| 내용 | 키 INT8 g64 + 값 signed INT4 g32 (2코드/바이트), 값은 회전하지 않음 |
| 컨텍스트 | INT8 171,648 → rk8v4 226,560 토큰 |
| KV @2,048 tok | 66.00 MiB → 51.00 MiB |
| Perplexity | bf16 4.343225 / int8 4.343263 / rk8v4 4.346811 |
| 디코드 (MTP3, C1) | 81.61 → 77.39 tok/s (−5.2%), 비추론 시 39.07 → 38.91 |
| 테스트 | ctest 99 pass / 0 fail / 6 skip, RTX 3090, CUDA 12.8, sm_86 |
| 권고 | 컨텍스트가 병목이면 rk8v4, 추론 속도가 중요하면 int8 |

---

## 6. 알려진 문제와 커뮤니티 해법

| 증상 | 원인 | 해법 |
|---|---|---|
| 생각이 끝나지 않음 (HF 토론 #97, #113) | 기본 `reasoning_effort=xhigh` | llama-server `--jinja --reasoning-effort medium/low`, API에서 `reasoning_effort` 지정, 또는 `--thinking-budget` |
| 무검열 모델이 여전히 거부 | thinking 체인이 거부를 재도출 | thinking OFF, 시스템 프롬프트 제거, V3형 빈 thinking 프리필 템플릿 사용 |
| MTP 켜도 속도 이득 없음 | GGUF에 nextn 텐서 없음 / parallel > 1 / 짧은 출력 | MTP 보존 GGUF 사용, `--parallel 1`, 긴 생성으로 측정 |
| Ollama에서 설정이 안 먹힘 | Ollama가 모델 템플릿을 교체 | llama.cpp 직접 사용 |
| 24GB에서 128K 이상 OOM | KV 메모리 | KV q4_0 또는 vLLM int8 KV(CTX=long), NInfer rk8v4 |

---

## 7. 출처

- https://github.com/Don-Chad/ninfer-3090/pull/16
- https://github.com/Don-Chad/ninfer-3090 (README, docs/cli.md, tools/convert/qwen3_8_27b/convert.py)
- https://github.com/syv-ai/qwen38-27b-rtx3090
- https://github.com/sudoingX/qwen38-mtp
- https://github.com/ggml-org/llama.cpp/pull/22673
- https://github.com/MiaAI-Lab/Qwen3.8-27B-DFlash2-EXL3-5.0bpw
- https://huggingface.co/Qwen/Qwen3.8-27B (및 discussions/97, /113)
- https://huggingface.co/huihui-ai/Huihui-Qwen3.8-27B-abliterated
- https://huggingface.co/orcarouter/Qwen3.8-27B-Uncensored (FP8 / GGUF 형제 저장소 포함)
- https://huggingface.co/hotdogs/Qwen3.8-27B-abliterated-MTP-GGUF
- https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF
- https://huggingface.co/OBLITERATUS/Qwen3.8-27B-OBLITERATED
- https://huggingface.co/0bserverx/Qwen3.8-27B-Heretic-Abliterated-Uncensored-GGUF
- https://huggingface.co/MuXodious/Qwen3.8-27B-absolute-heresy
- https://huggingface.co/leminkozey/Qwen3.8-27B-Uncensored-W4A16-AutoRound
- https://huggingface.co/twolven/Qwen3.8-27B-abliterated-AWQ-MTP
- https://www.hardware-corner.net/qwen3-8-27b-hardware-tests/
- https://moclaw.ai/blog/qwen-3-8-27b-overthinking
- https://x.com/superalesha/status/2089447151692595202 (NInfer 3090 제3자 실측)
- https://x.com/soyaakinohara5/status/2089002532878307738 (EXL3 3.69bpw 무검열)

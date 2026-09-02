<!-- 이 문서는 7개 각도 병렬 조사 + 적대적 검증 워크플로의 산출물입니다.
     생성: 2026-09-02 / 에이전트 64개 / 서브에이전트 토큰 약 249만 -->

> ## ⚠️ 이 문서를 읽기 전에 — 검증 커버리지 경고
>
> **7개 조사 각도 중 2개에서만 적대적 검증이 완료됐습니다.**
> 나머지 5개(chrome-mcp, replace, limits, hybrid, setup)는 검증 에이전트가
> 전부 실패해(StructuredOutput 재시도 한도 초과) **검증 없이 조사 결과만 실렸습니다.**
>
> | 각도 | 검증 통과 | 기각 | 상태 |
> |---|---|---|---|
> | bench | 3 | **5** | ✅ 검증됨 — 기각이 통과보다 많다는 점에 주목 |
> | harness | 1 | 1 | ✅ 검증됨 |
> | chrome-mcp / replace / limits / hybrid / setup | 0 | 0 | ❌ **검증 안 됨** |
>
> **`[검증]` 표기는 bench·harness 두 각도에만 유효합니다.**
> 나머지 섹션의 `[미검증]` 표기를 문자 그대로 받아들이세요.
>
> 또한 조사 환경의 egress 프록시가 huggingface.co, arxiv.org, reddit.com,
> artificialanalysis.ai 등 대부분의 1차 출처를 차단했습니다. GitHub 출처를 제외한
> 수치는 검색 엔진 요약에 의존합니다 (8-1절 참조).

---

# Qwen3.8-27B 로컬 코딩 활용 검토

*조사일 2026-09-02 · 7개 각도 조사 + 적대적 검증 결과 기반*
*표기 규칙: **[검증]** = 적대적 검증 통과 / **[벤더]** = 알리바바 자체 발표, 제3자 미재현 / **[기각]** = 검증에서 틀린 것으로 확인 / **[미검증]** = 조사는 됐으나 검증 절차를 거치지 않음 / **[자료 없음]** = 근거를 찾지 못함*

---

## 0. 결론

1. **대체는 아니다. 역할 분담이다.** Qwen3.8-27B는 "로컬 모델 역사상 최고"라는 평가가 제3자 지표로도 확인되지만(AA Intelligence Index 52 **[검증]**), 에이전틱 코딩의 공개 리더보드에서는 프론티어와 30포인트 이상 벌어져 있다(DeepSWE v1.1: Qwen 자체보고 42.2 vs Claude Opus 5 약 74.0).
2. **당신에게 비용 절감 논리는 성립하지 않는다.** Claude Code·Codex·Antigravity를 정액 구독 중이므로 토큰당 절감 개념 자체가 없다. 로컬을 정당화하는 것은 비용이 아니라 **레이트리밋 회피, 프라이버시, 대량 백필, 컨텍스트 전처리** 넷이다.
3. **성패는 모델이 아니라 하네스·런타임 접합부가 가른다.** 같은 모델이 llama.cpp 직결에서는 툴콜 실패 0건, Ollama의 `/v1` 경유에서는 무한 루프로 갈린다 **[미검증]**.
4. **Chrome MCP + 로컬 Qwen 실사용 사례는 하나도 찾지 못했다 [자료 없음].** Claude Code의 공식 크롬 연동(`claude --chrome`)은 Anthropic 구독 인증이 전제라 로컬 모델로는 아예 못 쓴다. 별도 MCP 서버 경로만 남는다.
5. **당신 하드웨어에 직결되는 가장 큰 공백: 4bit 양자화 상태의 코딩·툴콜 실측치가 공개된 것이 없다.** 3090 AWQ INT4도, MLX 4bit도 마찬가지다. 게다가 "4비트 양자화가 툴콜을 제대로 닫지 못한다"는 보고가 있다 **[미검증]** — 이건 직접 측정해야 한다.

---

## 1. 코딩 성능 — 수치와 그 수치의 신뢰도

### 1-1. 신뢰도 3등급

| 등급 | 의미 | 이 문서에서의 취급 |
|---|---|---|
| A. 제3자 측정 | Artificial Analysis, Arena 등 외부 기관이 직접 실행 | 사실로 인용 가능 |
| B. 벤더 자체 발표 | 알리바바가 자기 하네스로 측정, 경쟁 모델 점수는 인용(import) | "Qwen 주장"으로만 인용 |
| C. 벤더 사내 벤치 | Qwen이 벤치마크 자체를 제작 | 방향성 참고 이상 금지 |

### 1-2. A등급 — 제3자 지표

| 지표 | 값 | 검증 |
|---|---|---|
| AA Intelligence Index (v4.1.1) | **52** (전세대 Qwen3.6-27B 38 → +14) | **[검증]** AA 전용 페이지 `qwen3-8-27b (xhigh)` 실재. GPT-5.6 Luna 최대추론(52)과 동점. 파라미터 수 변화 없이 +14 |
| AA Agentic Index | **50.877 (≈51)** | 값은 확인. 그러나 순위 서술은 **[기각]** — 아래 참조 |

**Intelligence Index 52에 붙는 단서 [검증]:**
- 이 52점은 **xhigh(최상위이자 기본값)** 구성에서 나온 값이다.
- 측정 중 출력 토큰이 **1.6억 토큰** — 동급 오픈웨이트 중앙값 4,300만의 약 3.7배, GPT-5.6 Luna max 대비 약 2.3배. **품질만 동점이고 토큰·지연·전력 비용은 동점이 아니다.** 로컬에서 이건 곧 전기요금이고 대기시간이다.
- Intelligence Index는 코딩 전용이 아니라 GDPval-AA v2, τ³-Banking, Terminal-Bench v2.1, SciCode, HLE, GPQA Diamond, CritPt, AA-Omniscience, AA-LCR 9개의 합성이다.

**Agentic Index 51 — 널리 퍼진 서술이 틀렸다 [기각]:**

| 돌아다니는 주장 | 실제 |
|---|---|
| "2.8T Kimi K2 바로 뒤" | Kimi K2/K2.6은 **1T 총/32B 활성**이다. 2.8T는 **Kimi K3**(2026-07 공개). 바로 위에 있는 건 K3다 |
| "조 단위 MoE 바로 뒤 = 사실상 2위권" | 라이브 Agentic Index **7위**. 위에 Claude Opus 5, Grok 4.6, Qwen3.8 Max, GPT-5.6 Sol, Claude Fable 5, Kimi K3 |
| "최대추론 Claude Opus 4.8을 앞섰다" | 수치상 +1.502로 맞지만 Opus 4.8은 deprecated. 더 최신 Opus 5·Fable 5는 27B보다 **위**에 있다 |
| 정수 표기의 착시 | GPT-5.6 Terra 대비 +0.676, DeepSeek V4 Pro 대비 +1.315 — 반올림이 격차를 부풀린다 |

또한 **"Qwen 3.8 Agentic #1 / Intelligence 58"로 돌아다니는 수치는 27B가 아니라 Qwen3.8-Max(2.4T API 플래그십)의 것**이다. Max와 27B 혼동이 실제로 여러 매체에서 일어났다.

**미검증이지만 기록해 둘 제3자 신호 [미검증]:** Arena.ai Code Arena WebDev 1595점 전체 9위(톱10 중 유일한 소형 모델), Image-to-WebDev 오픈웨이트 1위·전체 7위.

### 1-3. B등급 — 벤더 자체 발표 (제3자 미재현)

> 아래 전부 알리바바가 **자기 하네스(Claude Code harness, temp=1.0, top_p=0.95, 256K ctx)로 측정**한 값이고, 경쟁 모델 점수는 재실행 없이 **공식 발표치를 인용**한 것이다. 즉 **같은 조건 비교가 아니다.**

| 벤치마크 | Qwen3.8-27B | 전세대 3.6-27B | Claude Opus 4.6 Max | 비고 |
|---|---|---|---|---|
| SWE-bench Pro | **61.7** | 53.5 | 53.4 | **[벤더/검증]** Qwen 61.7은 Qwen이 "문제 태스크를 교정한" refined set 재측정값, Opus 53.4는 원본 벤치 공식치. 조건 불일치 |
| LiveCodeBench v6 | **90.3** | **83.9** | 88.8 | **[벤더]** 세대 향상 6.4점. 흔히 인용되는 "전세대 80.4"는 **오류** — 향상폭을 9.9점으로 1.5배 과장 |
| Terminal-Bench 2.1 | 73.0 | 63.4 | 78.2(?) | **[벤더]** Qwen은 Terminus 하네스로 직접 측정, Opus 78.2는 인용. **78.2는 어떤 독립 보드에서도 확인 안 됨** |
| NL2Repo-Bench | 42.3 | — | 47.6 | **[벤더]** 저장소 단위 장기 생성. Opus 우세 |
| DeepSWE 1.1 | 42.2 | 13.3 | — | **[벤더]** "3배 상승". 아래 참조 |
| OSWorld-Verified | 84.3 | 63.9 | — | **[벤더]** |
| SWE-MM | 38.6 | 25.7 | — | **[벤더]** |
| GPQA Diamond | 89.2 | — | 91.3 | Opus 우세 (지식추론) |
| Humanity's Last Exam | 30.8 | — | 40.0 | Opus 우세 (지식추론) |

**벤더 표 전체 구도 [기각된 통념 정정]:** 표는 24개 벤치마크이고 Qwen이 16개에서 앞선다. "Opus가 앞서는 건 4개뿐"이라는 서술이 돌지만 실제로는 Opus가 앞서거나 밀리지 않는 항목이 8개다. 그리고 **Opus가 확실히 이긴 4개 중 절반(GPQA, HLE)은 코딩이 아니라 지식추론이다.**

따라서 흔히 유통되는 프레이밍 두 개가 모두 틀렸다:
- ❌ "Qwen이 실무 코딩에서 이겼다" → NL2Repo·Terminal-Bench에서 진다
- ❌ "실무 코딩 축에서는 Claude가 앞선다" → SWE-bench Pro(가장 대표적 멀티파일·저장소 에이전틱 SWE 벤치)에서는 Qwen이 앞선다고 벤더가 주장한다

정확한 구도는 **"벤더 표 기준으로 Qwen은 에이전틱 실행·컴퓨터유즈·지시이행에서 앞서고, 장기 호라이즌 저장소 생성·터미널 에이전트·지식 집약 추론에서 뒤진다"**이다.

### 1-4. Terminal-Bench 78.2 — 이 숫자를 쓰지 마라 [기각]

당신이 "로컬 코딩 에이전트"를 하려는 이상 Terminal-Bench가 가장 실전에 가깝다. 그런데 벤더 표의 대조군 78.2가 무너진다:

| 측정 | Opus 계열 Terminal-Bench |
|---|---|
| Qwen 벤더 표 (Opus 4.6 Max) | 78.2 (Anthropic 공식치 인용) |
| 공개 Terminus-2, Opus 4.8 (**더 나중 모델**) | 74.6 |
| 공개 Terminus-2, GPT-5.5 | **78.2** ← 같은 표의 GPT 점수와 일치 |
| LayerLens Terminus-2, Opus 4.6 | 58.75 |
| Anthropic 시스템카드 TB 2.0 max effort | 65.4 |

즉 78.2는 Anthropic 자체 Claude Code 하네스 기준치로 보는 게 가장 그럴듯하고, Qwen의 Terminus 73.0과는 **애초에 비교 대상이 아니다.** 동일 하네스로 맞추면 순위가 뒤집힐 가능성이 실재한다.

→ **결론: "터미널 에이전트에서는 Claude가 5.2점 앞선다"는 결론을 내리지 마라. 근거가 없다.** 방향성(벤더 자신의 표에서도 지는 항목이 있다)만 유효하다.

### 1-5. DeepSWE 1.1 — "3배 점프"의 실체

- 13.3 → 42.2 (3.17배)는 **[벤더]** 수치이고, 13.3이라는 기준선도 **Qwen이 자사 구모델을 자기 하네스로 재실행한 값**이다.
- 에이전트 벤치 점수는 툴콜 포맷 준수 실패에 극도로 민감하다. **3배 점프의 상당 부분이 능력 향상이 아니라 하네스 적합도 개선일 가능성을 배제할 수 없다.**
- 그리고 결정적으로, **DeepSWE v1.1 공개 리더보드가 존재한다**: Claude Opus 5 약 **74.0%**, GPT-5.6 Sol 약 **73.0%**, Claude Fable 5 약 70%, GLM 5.3 69.0%.
- 42.2는 "낮은 편" 정도가 아니라 **프론티어 선두 대비 약 57% 수준, 30포인트 이상 뒤진 값**이다. (단 42.2는 Qwen 자체 실행값이라 이 대조 역시 엄밀한 동일조건은 아니다.)

### 1-6. C등급 — Qwen 사내 벤치 [검증됨: 격리 대상]

| 벤치 | 값 | 성격 |
|---|---|---|
| QwenSWEBench | 79.0 (전세대 49.3) | Qwen 사내 SWE 벤치. Claude Code 하네스, avg@3, 8시간 타임아웃 |
| CoWorkBench | 70.7 (전세대 61.0) | **코딩 아님.** CS·금융·법률·의료 장기호흡 사무 과제, **GPT-4o 심판** |
| RecreationBench | — | Qwen 사내 |

**[검증]** 제3자 리뷰들이 일관되게 "no comparator lab has run them", "directional signals, not proof"라고 기술한다. 특히 CoWorkBench는 **자체 설계 과제 + GPT-4o 심판** 조합이라 편향 여지가 한 겹 더 있다.

### 1-7. LiveCodeBench 90.3의 치명적 단서 [검증]

LiveCodeBench v6는 **2023년 5월 ~ 2025년 4월** 공개 문제 1,055개다. LCB의 오염 회피 설계는 "모델 학습 컷오프 **이후** 공개된 문제"로 필터링할 때만 작동한다. Qwen3.8-27B와 Opus 4.6은 **둘 다 그 창 이후 출시**되어 post-cutoff 슬라이스가 남지 않는다. → **암기를 걸러낼 장치가 사라진 상태다. 90.3이라는 절대치도, 90.3 대 88.8이라는 우열도 코딩 실력의 직접 증거로 쓰면 안 된다.**

### 1-8. 아예 자료가 없는 것 [자료 없음]

| 지표 | 상태 |
|---|---|
| Aider polyglot | Qwen3.8-27B 점수가 벤더·제3자 어디에도 없음. llm-stats 보드 22개 모델에 미등재 |
| SWE-bench Verified | 알리바바 미발표. 전세대 값조차 출처마다 73.4/77.2로 엇갈림 |
| HumanEval / EvalPlus | 모델카드에 없는 것으로 보임 |
| GPT-5/Codex 계열과의 직접 비교표 | 없음. Qwen의 비교 대상은 Claude Opus 4.6 Max 위주 |
| **AWQ INT4 / MLX 4bit 상태의 코딩 벤치 재측정** | **전무.** 위 점수는 전부 풀 정밀도(또는 FP8) 서빙 기준 |
| SWE-bench Pro 61.7의 독립 재현 | 없음. Scale 공개 보드 미등재 |

**마지막 항목이 당신에게 가장 중요하다.** 3090 8장에서 INT4로, M3 Ultra에서 MLX 4bit로 돌렸을 때 위 점수가 얼마나 떨어지는지에 대한 공개 데이터가 **하나도 없다.**

### 1-9. 실사용 정성 평가 [미검증]

Simon Willison: "지금까지 최고의 로컬 모델"이라면서도 — 기본 `reasoning_effort=xhigh`의 과잉 추론(단순 SVG 하나에 **21분·22,276 추론 토큰**), 15~30 tok/s 속도 때문에 **호스팅 API를 대체하기는 어렵다**고 결론. *(이 구체 수치는 검증 절차를 거치지 않았다. 다만 AA 측정의 1.6억 출력 토큰 **[검증]**과 방향이 정확히 일치한다.)*

### 1-10. 당신의 abliterated 빌드에 대한 주의 (추론)

지금 맥북에서 돌리는 것은 **abliterated(안전정렬 제거) MLX 빌드**다. 위 벤치 수치는 전부 원본 가중치 기준이고, abliteration은 어텐션 방향 제거 방식이라 **툴콜 포맷 준수와 지시이행이 훼손될 수 있다.** 코딩 에이전트 백엔드로 쓸 때는 **원본 가중치를 별도 슬롯으로 두고 비교**하기를 권한다. 이 조합의 코딩 성능 실측 자료는 **[자료 없음]**.

---

## 2. 하네스별 실사용 — 무엇이 되고 무엇이 안 되는가

### 2-1. 유일한 검증 통과 항목

**[검증]** Cline 팀이 X 공식 계정에서(`x.com/cline/status/2089425906569977896`):

> "This is the first time a local model has scored frontier model capability. We weren't expecting this pace of local progress anywhere near this soon."

단, **인용 범위 주의**: Cline이 실제로 근거로 든 것은 **Artificial Analysis Intelligence Index 하나뿐**이고, 비교 대상도 DeepSeek V4-Pro와 GPT-5.6 Luna였다. Cline 원문 첫 문장은 "Artificial Analysis Intelligence Index puts Qwen3.8-27B at DeepSeek V4-Pro and GPT 5.6 Luna performance." — **Agentic Index나 SWE-bench Pro는 Cline이 언급하지 않았다.** 그리고 이건 벤치마크에 대한 반응 코멘트이지 **실제로 붙여 돌린 후기가 아니다.**

### 2-2. 하네스 생태계 현황 (2026-09 기준)

| 하네스 | 상태 | 근거 등급 |
|---|---|---|
| **Roo Code** | ❌ **2026-05-15 아카이브, 읽기 전용.** 저장소 배너 직접 확인: "This repository was archived by the owner on May 15, 2026." README: "The Roo Code Extension was shut down on May 15th." | **[검증]** |
| **Roomote** | RooCodeInc의 피벗처. 2026-07-07 개설, 활발. Slack/Teams/Telegram/Discord로 지시 → 샌드박스 클론 → PR. "No IDE plugin. No terminal session." | **[검증]** |
| **Kilo Code** | ✅ **살아 있다.** Kilo-Org/kilocode, 아카이브 아님, 스타 27.1k, 열린 이슈 433 / PR 122, 최신 커밋 2026-09-01, 2026-08-31 JetBrains 플러그인 v7.1.3 릴리스. **Roo에서 갈라졌다는 이유로 함께 배제하면 안 된다** | **[검증]** |
| **ZooCode** | Roo-Code README가 공식 안내하는 커뮤니티 포크 | **[검증]** |
| **Cline** | Roo-Code README가 공식 안내하는 대안. 로컬 모델에 적극적 | **[검증]** (존재), 설정 상세는 **[자료 없음]** |
| Pi | 경량, 도구 4개만 노출해 컨텍스트 절약. llama.cpp 조합에서 "툴콜 실패 없음" 보고 | **[미검증]** |
| OpenCode | 기능 풍부. 다만 로컬 모델 호환 이슈를 "not planned"로 닫는 정책 | **[미검증]** |
| Claude Code | Qwen 공식 벤치 환경. llama.cpp가 Anthropic Messages API 네이티브 지원(PR #17570, 2025-11-28 머지)이라 프록시 없이 직결 가능 | **[미검증]** |
| Hermes | 멀티시간 세션 툴콜 실패 0건 보고, 압축 내장 | **[미검증]** |
| Qwen Code | Qwen 공식 CLI | **[미검증]** |
| Zed / Cursor 로컬 / Goose / Crush / Continue.dev | **Qwen3.8-27B 구체 후기 [자료 없음]** (Continue는 "연결 가능"이라는 언급만) | — |

### 2-3. 전형적 실패 3갈래 [미검증 — 그러나 GitHub 이슈 6건은 조사자가 원문 직접 확인]

| 실패 유형 | 증상 | 원인 | 관련 이슈 |
|---|---|---|---|
| **(a) 툴콜 포맷 불일치** | 툴콜이 파싱 안 됨, 파서 500 | Ollama가 Hermes JSON 렌더러를 쓰는데 Qwen은 **Qwen3-Coder XML**로 학습됨. 툴 이름 대소문자, `</think>` 미닫힘, 잘린 JSON | Roo-Code #10780, ollama #14493/#17776, qwen-code #176 |
| **(b) 컨텍스트 조용한 절단** | 에러 없이 시스템 프롬프트부터 사라짐 | **Ollama 기본 컨텍스트 2,048토큰.** 최소 32K, 권장 64K로 명시 상향 필수 | ollama #17776 |
| **(c) 조용한 무동작** | edit/write 툴콜이 "성공"으로 표시되는데 파일이 안 생김 | 하네스-모델 계약 불일치 | opencode #234/#7030 |

**성공/실패 사례의 공통점 [미검증]:**
- 성공: **llama.cpp 직접 서빙 + 도구 표면적이 좁은 하네스 + 명시적 대용량 컨텍스트 설정**
- 실패: **Ollama의 OpenAI 호환 `/v1` 엔드포인트 경유**

### 2-4. 당신의 두 하드웨어 축에 직결되는 함정 [미검증 — 반드시 직접 확인할 것]

| 축 | 함정 |
|---|---|
| **RTX 3090** | 구버전 llama.cpp CUDA의 **Gated DeltaNet 버그**가 쓰레기 출력을 낸다. 재빌드 시 `libggml-cuda.so`까지 교체해야 함 (llama.cpp #27164) |
| **Apple Silicon** | **MTP GGUF가 non-MTP보다 2.3배 느리다.** 반면 MLX 경로는 3배 빠르다 |
| **GGUF 팩 차이** | MTP 드래프트 헤드가 **ggml-org GGUF에만 있고 unsloth 팩에는 없다.** 같은 Q4_K_M이라도 코드 생성에서 최대 **3.7배** 차이 — CLAUDE.md의 "MLX 4bit면 다 같다" 함정의 GGUF판 |

### 2-5. 평가 기준을 바꿔라 [미검증, 그러나 반복 지적됨]

**tok/s가 아니라 "정답까지의 wall-clock"으로 재라.** 27B는 xhigh 기본값에서 추론 토큰을 대량 태우므로, 초당 토큰이 빨라도 과제 완료 시간은 오히려 길 수 있다. AA 측정의 1.6억 출력 토큰 **[검증]**이 이를 뒷받침한다.

**262K 네이티브 컨텍스트는 코딩 에이전트에서 함정이다.** 실용성을 좌우하는 것은 컨텍스트 길이가 아니라 **하네스의 auto-compaction 품질**이다.

---

## 3. Chrome MCP — 정체, 설치, 실제 활용 사례

> ⚠️ **이 섹션은 전부 [미검증]이다.** 이 각도에서 적대적 검증을 통과한 항목이 하나도 없다. 그리고 가장 중요한 답부터 말하면:

### 3-1. 당신 질문에 대한 정직한 답: 실사례 [자료 없음]

**Qwen3.8-27B(또는 어떤 Qwen3.x 로컬 모델이든)로 Chrome DevTools MCP나 mcp-chrome을 돌려본 1차 사례를 단 하나도 찾지 못했다.**

검색으로 확인된 "로컬 모델 + 브라우저 MCP" 사례는 셋뿐이고, 어느 것도 27B급 dense 모델의 실측이 아니다:

| 사례 | 내용 | 한계 |
|---|---|---|
| ctheory/chrome-mcp-server | LM Studio 연동 | 권장 모델 목록 없음 |
| browser-use | Ollama/Qwen 지원 안내 | **`qwen-vl-max`만 권장. 나머지 Qwen은 action schema 오류** |
| Qwen 저장소 이슈 | MCP 툴콜 실패 보고 | 실패 기록이지 성공 사례가 아님 |

### 3-2. "Chrome MCP"는 하나가 아니다 — 최소 4갈래 [미검증]

| 이름 | 구조 | 강점 | 당신 용도 적합성 |
|---|---|---|---|
| **Chrome DevTools MCP** | Google Chrome DevTools 팀 공식, Puppeteer/CDP 기반, `npx`로 붙음 | 콘솔·네트워크·성능 트레이스·힙스냅샷까지 DevTools 전면 노출 | **프론트엔드 개발 루프(수정→확인→콘솔 에러→재수정)에 가장 정확히 맞음** |
| **mcp-chrome / chrome-mcp-server** (hangwin, ★12.4k) | 크롬 확장 + 네이티브 메시징 브리지 | **평소 쓰던 크롬의 로그인 상태 그대로 재사용**, 벡터DB 기반 탭 시맨틱 검색 내장 | 로그인 필요한 사이트 작업 |
| **Playwright MCP** | 스크린샷이 아닌 **접근성 트리**로 페이지 조작 | 크로스 브라우저 | 기존 크롬 세션 연결에 `--extension` + 전용 확장 필요 |
| **browser-use / Browserbase** | 전자는 세션·프로필 유지형 에이전트, 후자는 클라우드 호스팅 | — | browser-use만이 Ollama/Qwen 경로를 문서화 |

한 줄 요약: **Playwright는 "운전", DevTools MCP는 "진단"이다.**

### 3-3. 당신에게 직접 걸리는 두 가지 [미검증, 그러나 구조적으로 확실]

**(1) `claude --chrome`은 로컬 Qwen으로 절대 쓸 수 없다.**
Claude Code의 공식 크롬 연동은 Anthropic 직접 구독 인증이 전제다. 로컬 모델을 쓰려면 **반드시 별도 MCP 서버 경로(위 4갈래 중 하나)**를 거쳐야 한다. 이건 우회 방법이 없는 구조적 제약이다.

**(2) 토큰 문제가 실재하고, 27B에서 더 아프다.**

| 비용 항목 | 수치 | 신뢰도 |
|---|---|---|
| Chrome DevTools MCP 툴 정의만 | 약 **17,000 토큰** | GitHub 이슈 #340 작성자 주장, **측정법 미공개·Closed** |
| 매 턴 스크린샷/DOM 스냅샷 | 1회당 **4~5K 토큰** | 검색 스니펫만 확인, 원문 미접근 |
| 밀도 높은 페이지 | 컨텍스트 폭발로 에이전트 사망 사례 보고 | 미검증 |

**대응책 [미검증]:**
- `--slim` 플래그 — 툴 3개만 노출
- 요소 하위 트리 스냅샷 요청 (이슈 #716)
- 스크린샷 대신 시맨틱 텍스트 (OpenChrome의 5~15배 압축 DOM, lxe/chrome-mcp의 무스크린샷 설계)

**보안 함의:** `chrome-devtools-mcp --autoConnect`(Chrome 144+, `chrome://inspect`에서 원격 디버깅 활성화 필요)는 기존 로그인 세션 재사용 문제를 상당 부분 해결하지만, **그 대가로 에이전트가 당신의 쿠키·인증 상태를 그대로 상속한다.** 로컬 abliterated 모델에 이 권한을 주는 것의 위험을 별도로 판단해야 한다.

### 3-4. 권고

**27B 로컬 모델이 Chrome DevTools MCP의 40여 개 툴 정의를 안정적으로 다루는지에 대한 벤치마크가 전혀 없다 [자료 없음].** 참고할 선례가 없으므로, 유일한 경로는:

1. `--slim`(툴 3개)으로 시작해 툴콜 성공률을 먼저 측정
2. 성공하면 점진적으로 툴을 늘려 **몇 개에서 무너지는지 임계점을 찾는다**
3. 그 결과를 이 저장소 문서에 기록 — 공개 선례가 없으므로 당신 측정치가 곧 1차 자료가 된다

---

## 4. Codex/Claude 대체 가능성 — 정직한 답

### 4-1. 답: 아니오. 그리고 "대체"는 애초에 잘못된 질문이다.

이 각도에서 검증을 통과한 finding은 없지만 **[미검증]**, 조사 결론은 일관되고 근거의 방향이 서로 다른 네 갈래에서 같은 곳을 가리킨다.

### 4-2. 근거 1 — 수치 (검증된 것만으로도 결론이 난다)

| 축 | Qwen3.8-27B | 프론티어 | 출처 등급 |
|---|---|---|---|
| DeepSWE v1.1 (에이전틱 SWE) | 42.2 (자체 측정) | Opus 5 ≈74.0, GPT-5.6 Sol ≈73.0 (공개 보드) | **30포인트 이상 격차** |
| AA Agentic Index | 50.877 (7위) | Opus 5, Fable 5, Grok 4.6, GPT-5.6 Sol 모두 위 | **[검증]** |
| AA Intelligence Index | 52 | GPT-5.6 Luna max와 동점 | **[검증] — 여기서는 대등** |
| NL2Repo-Bench | 42.3 | Opus 4.6 Max 47.6 | **[벤더]** |

**즉 "지능 지표에서는 대등, 에이전틱 실행 지표에서는 격차"라는 그림이다.** 코딩 에이전트는 후자다.

### 4-3. 근거 2 — 당신은 정액 구독자다

이것이 결정적이다.

- 하이브리드 도구 `delegate-local` 저장소가 **스스로 인정하는 바**: 구독제 사용자에게 위임의 한계 API 비용은 **이미 0**이고, 프레이밍·응답 읽기·검증에 드는 프론티어 토큰이 **"헤드라인 절감분의 대부분을 먹어치운다"**. ROI는 세션당 50건 이상의 벌크 작업에서만 남는다. **[미검증]**
- 실측 절감 사례는 **월 $11 수준**, 손익분기는 **월 5,000만~8,000만 토큰**. **[미검증]**
- 자주 인용되는 RouteLLM의 **85% 절감**(MT-Bench, GPT-4 품질 95% 유지, 14%만 강모델)은 **MMLU 45%·GSM8K 35%로 급락**하므로 **코딩에 그대로 적용하면 안 된다.** **[미검증]**
- "하이브리드로 60~80% 절감", "10배 절감" 같은 수치는 **전부 마케팅 블로그이고 방법론이 공개되지 않았다.**

**→ 당신의 로컬 인프라를 정당화하는 것은 비용이 아니라 다음 넷이다: 레이트리밋 회피 / 프라이버시(민감 레포만 로컬) / 대량 백필 / 컨텍스트 전처리.**

### 4-4. 근거 3 — 섞는 것 자체가 막혀 있다 (당신의 확정 결정 5번이 옳았다)

**두 겹으로 막혀 있다 [미검증, 그러나 GitHub 이슈는 원문 확인됨]:**

| 방향 | 상태 |
|---|---|
| 로컬 모델 → Claude Code에 태우기 | `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`을 설정하면 Claude Code가 **OAuth 모드를 조용히 끄고 401**. 이슈는 **closed (not planned)** — 고쳐질 계획 없음 (anthropics/claude-code #33330, 원문 확인) |
| Claude 구독 → 남의 하네스에 태우기 | Anthropic이 **2026-02-19자로 구독 OAuth의 서드파티 사용 금지, 04-04부터 집행** (2·3차 보도로만 확인, 1차 문서 미확인) |

**→ 로컬 모델은 Claude Code와 "섞는" 것이 아니라 별도 하네스로 분리해 병렬 운용하는 것이 유일하게 안전한 구조다.** 당신의 CLAUDE.md 확정 결정 5번을 유지하라.

### 4-5. 근거 4 — 대체 시도 실패담의 공통 진단은 "모델이 멍청해서"가 아니다 [미검증]

| 접합부 문제 | 내용 |
|---|---|
| 프롬프트 오버헤드 | Claude Code가 사용자 입력 전에 약 **33K 토큰**(OpenCode의 4.7배)을 매 요청 재전송 |
| KV 캐시 무효화 | 매번 바뀌는 attribution 헤더가 로컬 KV 캐시를 무효화 → **처리량 90% 하락**. 수정은 셸 export가 아니라 `settings.json` |
| 툴콜 복리 붕괴 | 5~6단계 연쇄에서 문법 오류가 복리로 누적 |

Qwen3.8-27B를 실제로 Claude Code에 물린 기록도 **채팅 템플릿·시스템 프롬프트 크기·컨텍스트 윈도우** 문제로 정확히 같은 지점에서 걸렸다.

### 4-6. 두 가지 유리한 변화 [미검증]

1. **llama.cpp가 Anthropic Messages API를 네이티브 지원한다** (ggml-org/llama.cpp PR #17570, 2025-11-28 머지, **원문 확인**) → 번역 프록시 한 겹을 뺄 수 있다.
2. **Anthropic이 Claude Code 시스템 프롬프트를 80% 축소했다** → 과거 실패담의 오버헤드 수치(33K 등)를 현재에 그대로 적용하면 안 된다.

### 4-7. 당신에게 해당되지 않는 흔한 감점 사유

"로컬은 VRAM 때문에 병렬 세션을 못 띄운다"는 지적은 **24GB 단일 GPU를 전제**한 것이다. **3090 8장 × 2대인 당신에게는 해당되지 않는다.** 이건 당신의 실질적 우위다.

---

## 5. 로컬 27B의 실질 한계 (기술적 근거)

> **[미검증]** — 이 각도에서 검증을 통과한 finding은 없다. 다만 vLLM GitHub 이슈 2건은 조사자가 원문을 직접 확인했다. 논문 수치는 전부 검색 요약에서 읽은 것이므로 **인용 전 원문 재확인 필요**.

무너지는 지점은 "추론력"이 아니라 네 군데다.

### 5-1. 배관 (파서)

vLLM 이슈 **#39056**, **#29192** (원문 직접 확인): **모델이 올바른 툴 콜을 생성했음에도** reasoning 파서와 tool 파서의 필드 분리 때문에 `tool_calls` 배열이 **빈 채로** 나간다. 프론티어 API에서는 벤더가 흡수하는 계층을 로컬에서는 당신이 직접 감당해야 한다.

### 5-2. 파서 실패 → 무한 루프 점화

arXiv 2607.01641: 무한 에이전트 루프 실패의 **69.1%**가 경계 없는 재시도·툴콜 반복에서 오고 **파서 오류가 그 방아쇠**다. 실측 사례로 한 로컬 모델이 같은 깨진 호출을 반복하며 **3만 토큰**을 태운 보고가 있다.

### 5-3. 컨텍스트 — 262K로도 부족하고, 그마저 균질하지 않다

| 사실 | 수치 |
|---|---|
| 코딩 에이전트 세션 1건의 규모 | 문제당 평균 **800만 토큰 · 154턴** (Qwen3-Coder-Next 측정, arXiv 2606.23525) |
| lost-in-the-middle | 중간 40~60% 구간 급락, **100K에서 50%+ 저하** |
| **Qwen3.8-27B 구조적 취약점** | **64층 중 48층이 Gated DeltaNet(선형)** → full-attention이 **25%뿐** |

**이게 가장 중요한 대목이다.** 선형 어텐션은 고정 크기 상태 때문에 **연관 회상(associative recall)에 근본적 한계**가 있고, 회상 능력이 full-attention 비율에 크게 좌우된다. **"100턴 전에 읽은 함수 시그니처를 되짚는 능력"이 정확히 이 약점 위에 놓인다.** 262K는 담을 수 있어도 되짚지는 못한다는 뜻이다.

→ **262K는 실사용 값이 아니다. 압축·핸드오프 품질이 곧 에이전트 품질이 된다.**

### 5-4. 다중 파일 리팩터링

SWE-Bench ProMax(평균 **11.4파일 · 261.6줄**, arXiv 2608.09802): **최고 모델조차 41.2%**에 그치고, 규모가 커지면 "모든 모델이 무너진다"고 기술된다. 이건 27B의 문제가 아니라 현재 기술 전체의 천장이지만, 27B는 그 아래에 있다.

### 5-5. ⚠️ 당신 계획에 직접 걸리는 항목 — 4비트 양자화의 툴콜 실패

**4비트 양자화(AWQ INT4 · NVFP4)가 툴 콜을 제대로 닫지 못하는 구조적 출력 실패를 보였고, FP8 · INT8은 정상이었다는 보고가 있다.** **[미검증]**

**3090 AWQ INT4 경로도, MLX 4bit 경로도 모두 이 구간에 있다.** 그리고 1-8절에서 말했듯 4bit 상태의 툴콜 정확도 실측은 **공개된 것이 없다 [자료 없음]**.

→ **이건 당신이 직접 측정해야 하는 최우선 항목이다.** 툴콜 100회 성공률을 FP8/INT8과 INT4에서 각각 재라. 3090은 FP8 텐서코어가 없으므로(CLAUDE.md 함정 항목), 실질 선택지는 **INT8 vs INT4**이고 여기서 VRAM과 툴콜 신뢰성이 정면으로 충돌한다.

### 5-6. M3 Ultra의 컨텍스트 천장

**M3 Ultra 96GB에서 65K 프롬프트 프리필이 Metal 커맨드 버퍼 한계로 60% 지점에서 무너진다는 보고** **[미검증]**. 사실이라면 **262K는 이 하드웨어에서 실사용 값이 아니다.**

---

## 6. 권장 운용 — 이 사람의 하드웨어와 구독 기준

### 6-1. 원칙

> **로컬은 "컨텍스트를 한 번 모아 한 번의 프롬프트로 텍스트를 돌려주는 작업"을 맡고, 프론티어는 "다단계 추론·툴콜 체인·레포 전역 리팩터·터미널 자율 실행·정확성 검증"을 맡는다.** — 2026년 9월 시점 제3자 서술이 거의 예외 없이 도달한 결론 **[미검증]**

Qwen3.8-27B가 나온 뒤에도 이 결론은 바뀌지 않았고, **다만 로컬이 맡는 비중이 커졌을 뿐**이다.

### 6-2. 작업 분배표

| 로컬 Qwen3.8-27B에 넘길 것 | 프론티어(Claude Code / Codex)에 남길 것 |
|---|---|
| 요약, 로그 분류·분석 | 레포 전역 리팩터, 신규 아키텍처 설계 |
| 커밋 메시지, 체인지로그 | 다단계 툴콜 체인 (5단계 이상) |
| 배치 분류, 구조화 추출 | 터미널 자율 실행 |
| 정규식, 유닛 테스트 생성 | 정확성 검증 (최종 판정) |
| 집중된 **단일 디프** 리뷰 | 멀티파일 리팩터 |
| 코드 자동완성 | 애매하게 정의된 버그 추적 |
| **잘 정의된 작은 버그** (자기검증 가능한 것) | 100턴 이상 장기 세션 |
| **대량 백필** (녹취 전사 후처리 등) | 프론트엔드 브라우저 루프 (당분간) |
| **민감 레포** (외부 전송 금지 대상) | — |

핵심 필터: **"자기검증 가능한가?"** — 테스트가 통과/실패로 판정해 주는 작업만 로컬에 맡겨라. 판정 주체가 사람이거나 LLM인 작업은 프론티어에 두어야 한다.

### 6-3. 계층별 역할 (당신 인벤토리 기준)

| 계층 | 기기 | 권장 역할 | 근거 |
|---|---|---|---|
| **T0** | MacBook M3 Max 64GB | 이동 중 단발 질의, abliterated 빌드 실험 | 현재 이미 운용 중 |
| **T1** | Mac Studio M3 Ultra 96GB | **oMLX + MTP 상시 서빙.** 커밋 메시지·요약·단일 디프 리뷰·자동완성 백엔드 | MLX 경로가 GGUF 대비 3배 **[미검증]**. 65K 프리필 천장 주의 |
| **T2-A** | 3090×8 + NVLink×4 | **W4A16(또는 INT8) vLLM 상시 서빙.** 병렬 세션 다수, 배치 작업 | NVLink 4쌍이 듀얼 GPU 이득 확보에 유리 **[미검증]** |
| **T2-B** | 3090×8 (TR Pro) | **대량 백필 · 양자화 실험 · 툴콜 성공률 측정** | 재부팅 자유 머신 |
| **T3** | Claude Code / Codex / Antigravity | 설계, 리팩터, 최종 검증, 브라우저 루프 | 구독 유지 |

### 6-4. 하이브리드 구현 난이도 순서 [미검증]

| 난이도 | 방식 | 예시 |
|---|---|---|
| 쉬움 | **기능별 고정 배치** | Continue식: 자동완성=소형 로컬, 채팅=프론티어 |
| 중간 | **카테고리 라우팅** | Claude Code Router식: `background`만 로컬 Ollama, `longContext` 임계 60000 |
| 어려움 | **검증 신호 기반 캐스케이드** | 로컬 시도 → 테스트 실패 시 프론티어 에스컬레이션 |

**쉬운 것부터 하라.** 캐스케이드는 마지막이다.

### 6-5. 지금 당장 할 것 (우선순위)

1. **툴콜 성공률 측정 (최우선).** Station B에서 W4A16 vs INT8로 툴콜 100회 성공률 비교. 5-5절의 4bit 실패 보고를 자기 환경에서 재현/기각하라. 공개 자료가 없으므로 이 측정이 곧 의사결정 근거다.
2. **`reasoning_effort`를 `medium`으로 내려라.** 기본값 xhigh는 코딩 에이전트에서 대기시간을 3배 늘린다 **[미검증]**. AA의 1.6억 출력 토큰 **[검증]**이 방증.
3. **평가 지표를 wall-clock으로 바꿔라.** tok/s를 버려라.
4. **하네스는 Pi나 Cline처럼 도구 표면적이 좁은 것부터.** Ollama `/v1` 경유는 피하고 llama.cpp/vLLM/oMLX 직결.
5. **Roo Code는 후보에서 빼되, Kilo Code는 남겨라 [검증].**
6. **Chrome MCP는 `--slim`(툴 3개)로 시작.** 선례가 없으므로 임계점을 직접 찾아야 한다.

---

## 7. 실제 설정 — 명령어와 config

> **[미검증]** — 아래는 setup 각도의 조사 결과이며 적대적 검증을 거치지 않았다. **단 vLLM 레시피 YAML은 `raw.githubusercontent.com`을 통해 원문을 직접 받았으므로 그 부분만 신뢰도가 높다.** 나머지는 실행 전 각자 1차 출처 재확인 필요.

### 7-1. vLLM 공식 플래그 (원문 확인)

```bash
--reasoning-parser qwen3 \
--enable-auto-tool-choice \
--tool-call-parser qwen3_coder
```

**가장 흔한 함정: 코더 전용 모델이 아닌데도 파서 이름이 `qwen3_coder`다.** 이유는 이 모델의 툴콜이 JSON이 아니라 **XML**로 나오기 때문이다. 이걸 틀리면 2-3절의 (a) 실패 유형에 정확히 걸린다.

| 요구사항 | 버전 |
|---|---|
| vLLM | ≥ 0.17.0 |
| transformers | ≥ 5.8.0 |
| DFlash2 투기적 디코딩 | ≥ 0.28.0 |

### 7-2. ⚠️ 공식 레시피에 RTX 3090이 없다

**vLLM 공식 레시피의 양자화·하드웨어 표에 Ampere(3090)가 아예 없다.** INT4(W4A16, 24GB) 항목조차 지원 대상이 **H100 이상과 RTX 5090**뿐이고, 검증된 하드웨어는 **GB300 / RTX 5090 / Ascend 950PR** 셋뿐이다.

→ **3090 스테이션은 공식 경로가 아니라 커뮤니티 경로를 따라야 한다.**

### 7-3. RTX 3090 커뮤니티 레시피 [미검증]

- 저장소: `syv-ai/qwen38-27b-rtx3090`
- 가중치: **`dbirks/Qwen3.8-27B-W4A16-AutoRound`**
- vLLM 0.27.1 + 자체 패치
- `CTX=fast/long/huge`로 KV를 bf16 → int8 → 4·2bit로 바꿔 **64k / 150k / 240k**를 오간다

**실측:** 단일 3090 **120~133 tok/s**, 64동시 약 **1,035 tok/s**

**Ampere 특유의 제약:**
- 선형 어텐션의 **recurrent-state 풀이 고갈**되어 동시 상주 요청이 **5~8개로 제한**
- **NVLink 없는 듀얼 GPU는 batch 1에서 16~35% 이득에 그친다** → NVLink 4쌍을 가진 **Station A가 유리**하다는 근거

> 📌 **CLAUDE.md 갱신 필요:** 현재 문서의 "**AWQ INT4**를 쓸 것"이라는 표기는 포맷명 수준에서 갱신이 필요하다. Qwen3.8-27B의 실제 3090용 검증 배포본은 **W4A16 AutoRound**이며, **`AWQ-INT4`라는 포맷명으로 된 Qwen3.8-27B 배포본을 찾지 못했다 [자료 없음]**.

### 7-4. Mac (M3 Ultra / M3 Max) — oMLX 경로 [미검증]

```bash
brew install omlx
hf download Jundot/Qwen3.8-27B-oQ4e-mtp
omlx restart
```

→ OpenAI 호환 서버가 선다.

`~/.omlx/model_settings.json`:
```json
{
  "mtp_num_draft_tokens": 3,
  "gdn": "on",
  "max_context_window": 262144
}
```

**실측:** M3 Ultra **65~75 tok/s**, 툴콜 **4/4 성공 · JSON 오류 0건**

### 7-5. Mac에서 피해야 할 것 [미검증]

| 경로 | 문제 |
|---|---|
| **Apple 공식 `mlx_lm.server`** | `_infer_tool_parser()`가 Qwen3 **비-Coder** 챗 템플릿을 인식 못해 `tools`를 넘기면 **빈 응답**을 반환. 미해결 이슈 **#1293**. **코딩 에이전트 백엔드로 부적합** |
| **Ollama** | M3 Ultra에서 약 **14 tok/s** — 이전 세대(28.6)의 **절반**. 원인은 하이브리드 어텐션용 Metal 커널 미성숙 (CLAUDE.md 함정 항목과 일치) |

⚠️ **단서:** mlx-lm 이슈 #1293은 Qwen **3.5/3.6**을 명시하고 **Qwen3.8은 언급하지 않는다.** 같은 계열 챗 템플릿이라 영향받을 가능성이 높다고 추정할 뿐, **Qwen3.8-27B에서 실제로 깨지는지는 확인된 사실이 아니다.**

### 7-6. 공통 튜닝

| 항목 | 권장값 | 이유 |
|---|---|---|
| `reasoning_effort` | **`xhigh` → `medium`** | 대기시간 약 1/3 감소, 품질 저하 미측정 **[미검증]** |
| 컨텍스트 (Ollama 사용 시) | **최소 32K, 권장 64K** | 기본 2,048은 에러 없이 시스템 프롬프트부터 버린다 |
| GGUF 팩 | **ggml-org 팩** (MTP 드래프트 헤드 포함) | unsloth 팩에는 없어 코드 생성 최대 3.7배 차이 |
| llama.cpp CUDA 재빌드 시 | **`libggml-cuda.so`까지 교체** | Gated DeltaNet 버그로 쓰레기 출력 |

### 7-7. 알아둘 것

- **Qwen3.8 세대에 Coder 전용 변종은 출시되지 않았다.** (`qwen3_coder` 파서 이름과 혼동 금지)
- llama.cpp의 Anthropic Messages API 네이티브 지원(PR #17570)으로 **번역 프록시 없이 Claude Code 하네스에 직결 가능** — 단 4-4절의 인증 제약은 별개다.

---

## 8. 확인하지 못한 것 (gaps)

### 8-1. 조사 환경의 구조적 제약

이번 조사는 **egress 프록시가 대부분의 도메인을 차단**한 환경에서 수행됐다. 원문을 직접 열 수 있었던 것은 **github.com, raw.githubusercontent.com** 정도이고, 다음은 전부 차단됐다:

`huggingface.co` · `arxiv.org` · `artificialanalysis.ai` · `simonwillison.net` · `venturebeat.com` · `recipes.vllm.ai` · `medium.com` · `dev.to` · `news.ycombinator.com` · `reddit.com`(크롤러 차단) · `clien.net` · `arca.live` · `codersera` · `kingy.ai` · `northflank.com` · `mindstudio.ai` · `nxcode.io` · `orcarouter.ai` · `regolo.ai` · `docs.litellm.ai` · `docs.cline.bot` · `developer.chrome.com` 외 다수

**→ 위 문서의 수치 중 GitHub 출처를 제외한 대부분은 검색 엔진 요약에 의존한다. 원문의 전제조건·반박 댓글·정정 이력을 확인하지 못했다.**

특히 **`reddit.com`의 r/LocalLLaMA가 통째로 빠진 것**이 가장 아프다. 이 각도에서 가장 밀도 높은 1차 후기가 있는 곳이다.

### 8-2. 당신 상황에 직결되는데 자료가 없는 것 (중요도순)

| # | 공백 | 왜 중요한가 |
|---|---|---|
| 1 | **4bit 양자화(AWQ INT4 / W4A16 / MLX 4bit) 상태의 코딩 벤치 및 툴콜 정확도 실측** | 모든 공개 점수가 풀 정밀도/FP8 기준. 당신이 실제로 돌릴 구성의 성능을 **아무도 모른다** |
| 2 | **3090 8장(TP8) 구성의 1차 출처** | 확인된 커뮤니티 레시피는 **단일 · 듀얼 3090뿐**. 48개 Gated DeltaNet 레이어가 텐서 병렬에서 스케일하는지, recurrent state가 어떻게 샤딩되는지 자료 없음. **TP8 하나로 묶을지 TP2×4로 쪼갤지 판단 불가** |
| 3 | **Qwen3.8-27B + Chrome MCP 실사례** | 질문 (3)의 직접 답. **전무** |
| 4 | **Mac Studio M3 Ultra 96GB(바이닝)에서 코딩 에이전트 하네스를 붙인 실측** | 확인된 Apple Silicon 수치는 M4 Pro, M5 Max, M3 Ultra(Ollama 단독)뿐. **하네스 왕복 포함 M3 Ultra 실측은 공백** |
| 5 | **AWQ INT4 + vLLM으로 3090 다장에 올려 코딩 에이전트를 붙인 사례** | Station A 구성에 가장 가까운 형태인데 **없다.** 확인된 3090 사례는 전부 단일 카드 + llama.cpp |
| 6 | **동일 과제를 로컬 27B와 Claude/Codex에 각각 시킨 통제된 1인칭 비교** (통과율·수정 횟수·소요 시간) | **하나도 없다.** 나온 것은 정성 서술이거나 서로 다른 출처의 벤치를 갖다 붙인 것 |
| 7 | Ampere에서 `--kv-cache-dtype fp8` 동작 여부 | 공식 레시피의 fp8 KV 예시는 전부 Blackwell/Hopper 대상. **단정할 자료 없음** |

### 8-3. 벤치마크 공백

- **Aider polyglot** — Qwen3.8-27B 점수 없음 (벤더·제3자 모두)
- **SWE-bench Verified** — 알리바바 미발표
- **HumanEval / EvalPlus** — 확인 불가
- **RULER / LongBench** (특히 128K·262K 지점) — Qwen3.8-27B 제3자 실측 없음
- **BFCL v4 에이전틱/멀티턴** — 없음
- **GPT-5 / Codex 계열과의 직접 비교표** — 없음. Qwen의 비교 대상은 Opus 4.6 Max 위주
- **IFBench / Multi-IF에서 27B 대 프론티어 지시이행 격차** — 없음
- **Gated DeltaNet 하이브리드가 에이전틱 코딩(툴콜 궤적 회상)에서 순수 어텐션 대비 얼마나 손해인지 직접 측정한 자료** — 없음 (5-3절의 논증은 일반 원리에서 유도한 것)
- **로컬 1차 코드리뷰 필터의 정량적 품질 손실(재현율/정밀도)** — 없음. 찾은 리뷰 벤치는 전부 프론티어 간 비교

### 8-4. 신뢰도가 낮은 채로 인용된 수치

| 수치 | 문제 |
|---|---|
| Chrome DevTools MCP 툴 정의 17,000 토큰 | GitHub 이슈 작성자 주장, 측정법 미공개, 이슈 Closed |
| 스크린샷 1회 4~5K 토큰 | 원문 미접근, 검색 스니펫만 |
| "Playwright MCP 대비 78% 토큰 절감" | Medium 글, 본문 미검증 |
| arXiv 논문 수치 전체 (69.1%, 41.2%, 11.4파일, 800만 토큰/154턴) | **원문 표를 직접 확인하지 못했다.** 인용 전 재확인 필요 |
| Anthropic 서드파티 OAuth 금지 날짜 (2026-02-19 / 04-04) | 2·3차 보도로만 확인, 1차 문서 미확인 |
| "하이브리드 60~80% 절감", "10배" | 전부 마케팅 블로그, 방법론 비공개 |
| betterclaw "4개 하네스 전부 hang" | SEO성 블로그 요약만. 인용된 Ollama 이슈 2건을 특정하지 못함 |

### 8-5. 편향 경고

**커뮤니티 원 스레드(Reddit 등)가 검색에 거의 잡히지 않아 블로그·미디어 기사 위주로 편향됐을 가능성이 있다. 블로그는 성공담 쪽으로 기울기 쉬우므로 실제 실패율은 이 문서에 정리된 것보다 높을 가능성이 있다.**

---

## 참고 자료

### 원문 직접 확인 (신뢰도 높음)
| 출처 | 내용 |
|---|---|
| https://github.com/RooCodeInc/Roo-Code | 아카이브 배너 "archived by the owner on May 15, 2026" |
| https://github.com/RooCodeInc/Roo-Code/issues/10780 | llama.cpp 툴콜 실패 이슈 + 아카이브 확인 |
| https://github.com/Kilo-Org/kilocode | 활성 확인 (★27.1k, 2026-09-01 커밋) |
| https://github.com/RooCodeInc/Roomote | Roo 팀 피벗처 |
| https://github.com/anthropics/claude-code/issues/33330 | `ANTHROPIC_BASE_URL` 설정 시 OAuth 무효화, closed (not planned) |
| https://github.com/ggml-org/llama.cpp/pull/17570 | Anthropic Messages API 네이티브 지원 (2025-11-28 머지) |
| https://github.com/vllm-project/vllm/issues/39056 | tool_calls 빈 배열 파서 실패 |
| https://github.com/vllm-project/vllm/issues/29192 | reasoning/tool 파서 필드 분리 문제 |
| https://github.com/vllm-project/recipes | `--reasoning-parser qwen3`, `--tool-call-parser qwen3_coder` (YAML 원문) |
| https://x.com/cline/status/2089425906569977896 | Cline 공식 코멘트 |

### 검색 요약으로만 확인 (원문 미접근)
| 출처 | 내용 |
|---|---|
| https://simonwillison.net/2026/Aug/17/qwen-38-27b-scores-52/ | AA Intelligence Index 52 **[검증]** |
| https://artificialanalysis.ai/models/qwen3-8-27b | AA 전용 모델 페이지 (xhigh) |
| https://huggingface.co/Qwen/Qwen3.8-27B | 공식 모델카드 — **모든 벤더 수치의 1차 출처** (직접 열람 실패) |
| https://venturebeat.com/technology/qwen3-8-27b-runs-frontier-class-coding-agents-and-reasoning-locally-no-cloud-api-required | Cline 코멘트 보도 |
| https://www.yottalabs.ai/post/qwen-3-8-benchmarks-what-is-verified-2026 | 벤치 검증 정리 |
| https://kingy.ai/blog/qwen3-8-27b-specs-benchmarks-local-hardware/ | LiveCodeBench 등 |
| https://www.nxcode.io/resources/news/qwen3-8-27b-local-agent-model-2026 | Terminal-Bench, NL2Repo |
| https://www.orcarouter.ai/blog/qwen-3-8-27b-for-coding | DeepSWE. **단 2026-08-15자 "AA 미채점" 서술은 낡은 정보** |
| https://www.mindstudio.ai/blog/qwen-3-27b-local-benchmark | Agentic Index |

### 모델·레시피 저장소 (미검증)
- `syv-ai/qwen38-27b-rtx3090` — 3090 커뮤니티 레시피
- `dbirks/Qwen3.8-27B-W4A16-AutoRound` — 3090용 양자화
- `Jundot/Qwen3.8-27B-oQ4e-mtp` — oMLX MTP 팩
- `ml-explore/mlx-lm` issue #1293 — `_infer_tool_parser()` 빈 응답
- `ollama/ollama` issues #14493, #17776 — 툴콜 포맷 / 컨텍스트 절단
- `ggml-org/llama.cpp` issue #27164 — CUDA Gated DeltaNet 버그
- `sst/opencode` issues #234, #7030 — 조용한 무동작
- `QwenLM/qwen-code` issue #176 — MCP 툴콜 실패
- `Aider-AI/aider` issue #2371

### Chrome MCP
- `ChromeDevTools/chrome-devtools-mcp` (issues #340 토큰, #716 하위트리 스냅샷)
- `hangwin/mcp-chrome` (★12.4k)
- `microsoft/playwright-mcp`
- `browser-use/browser-use` — Ollama/Qwen 안내 (**qwen-vl-max만 권장**)

### 논문 (전부 검색 요약, 원문 미확인 — 인용 전 재검증 필요)
- arXiv **2607.01641** — 무한 에이전트 루프 실패의 69.1%가 경계 없는 재시도
- arXiv **2608.09802** — SWE-Bench ProMax, 평균 11.4파일/261.6줄, 최고 41.2%
- arXiv **2606.23525** — 코딩 에이전트 세션 문제당 800만 토큰/154턴
- arXiv **2605.01471** — 30%/113회
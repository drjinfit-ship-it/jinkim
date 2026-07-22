# 8단계. AI 에이전트 동향 + OpenClaw·옵시디언·헤르메스 연동 (2026년 7월 조사)

> 질문: "로컬 모델로 에이전트를 어디까지 구현할 수 있나? 잘 쓰고 있는 사례는?
> OpenClaw에 옵시디언·헤르메스를 연동하려면?"에 대한 조사 결과입니다.

## 8-1. 결론 요약

1. **로컬 모델로도 에이전트의 70~80%는 됩니다.** 단순~중간 난이도 도구 호출(일정 등록, 메일 분류, RAG 답변, 문서 추출, 음성 파이프라인)은 GLM-4.5-Air·Qwen3-235B급 로컬 모델이 프론티어(Claude급)와 거의 대등합니다. 아직 확실히 밀리는 것은 **수 시간짜리 장기 자율 작업**(복잡한 코딩, 다단계 정책 준수 상담)입니다.
2. **"헤르메스" = Nous Research의 Hermes Agent** (2026.2.25 출시, 4개월 만에 GitHub 별 17.5만개). OpenClaw의 최대 라이벌이며, **로컬 모델 지원과 보안이 OpenClaw보다 우수**합니다. 박사님 장비(대형 vLLM 서버)에는 오히려 Hermes가 더 잘 맞습니다.
3. **옵시디언 연동은 세 가지 방법**이 있고(아래 8-4), 가장 실용적인 것은 "옵시디언 볼트 = 에이전트 작업폴더" 패턴입니다.
4. **보안이 이 분야 최대 이슈**입니다. OpenClaw는 2026년 초 노출 게이트웨이 3만대, 악성 스킬 수백 개 사태를 겪었습니다. 게이트웨이를 인터넷에 열지 말고 Tailscale로만 접근하는 것이 철칙입니다.

## 8-2. 로컬 모델로 어디까지 구현 가능한가 (실측 근거)

### 도구 호출(function calling) 성능 — 벤치마크 기준

| 모델 | BFCL-v3 (도구호출) | 비고 |
|---|---|---|
| GLM-4.5 (오픈) | **77.8 — 오픈 1위** | Claude Sonnet 4급 |
| GLM-4.5-Air (106B, ~63GB) | 76.4 | **GB당 성능 최강. B컴퓨터에 최적** |
| Qwen3-235B-A22B-2507 | 70.8 | A컴퓨터 주력 후보 |
| gpt-oss-120b | o4-mini급 (τ-Retail) | 65GB로 가볍고 빠름 |
| K-EXAONE-236B | SWE-bench 49.4 | 한국어 최강이지만 에이전트 코딩은 한 수 아래 |

### 로컬로 잘 되는 것 vs 아직 클라우드가 필요한 것

| 로컬로 충분 (지금 바로 시연 가능) | 아직 프론티어(Claude 등) 필요 |
|---|---|
| 일정 등록/조회, 메일 분류·요약 | 수 시간짜리 자율 코딩 (Terminal-Bench: 오픈 최고 ~52-69 vs 클로즈드 ~88-92) |
| RAG 질의응답 (암묵지 검색) | 복잡한 정책 준수형 상담 (τ2-Telecom: Qwen3 ~33 vs Opus 99.3) |
| 구조화 추출(JSON) — 문법 강제 디코딩으로 사실상 100% 유효 | 심층 웹 리서치 (BrowseComp급) |
| 음성→텍스트→분류→저장 파이프라인 | 50단계 이상 오류 누적되는 장기 작업 |
| 한국어 문서 요약·초안 (K-EXAONE, Solar) | |

### 하이브리드가 2026년 표준 아키텍처

- 실무 통계: 요청의 60~70%는 로컬로 충분한 "단순" 작업 → 하이브리드로 비용 60~80% 절감.
- 구성: LiteLLM 게이트웨이에서 **민감한 데이터·일상 작업 → 로컬 vLLM / 어려운 작업 → Claude API**로 라우팅.
- Claude Code를 로컬 모델로 돌리는 것도 가능: claude-code-router 또는 LiteLLM의 `/v1/messages` 변환. GLM-4.7은 아예 Claude Code 하니스에 맞춰 후훈련된 모델.

### 박사님 vLLM 서버를 "에이전트 두뇌"로 만드는 실행 명령

```bash
vllm serve Qwen/Qwen3-235B-A22B-AWQ \
  --tensor-parallel-size 8 \
  --enable-auto-tool-choice --tool-call-parser hermes \
  --reasoning-parser qwen3
```

- `--tool-call-parser hermes`: Qwen3는 Nous Research의 **Hermes 함수호출 형식**을 쓰므로 이 파서가 정답. (Hermes Agent 공식 문서도 vLLM에 이 옵션을 요구)
- GLM-4.5-Air면 `--tool-call-parser glm45`, gpt-oss면 `openai`, Kimi K2면 `kimi_k2`.
- JSON 추출은 `response_format={"type":"json_schema"}` (xgrammar 문법 강제)로 무조건 유효한 JSON 보장.

## 8-3. OpenClaw 현황 (2026년 7월)

- Peter Steinberger 작. Clawdbot(2025.11) → Moltbot → **OpenClaw**(2026.1.30). GitHub 별 ~38만개. 현재 비영리 재단 체제(OpenAI·NVIDIA·MS·텐센트 후원), 버전 2026.7.x.
- 구조: **게이트웨이**(포트 18789, 로컬 전용)가 중심. 멀티 에이전트(작업공간 격리), 스킬(SKILL.md 마크다운), MCP(mcporter), 크론 예약작업, 메모리(MEMORY.md + 일일노트 마크다운).
- 채널 23종: 텔레그램/왓츠앱/디스코드/슬랙/시그널/iMessage… **카카오톡은 커뮤니티 플러그인**(kakao-relay 서버 별도 필요). 한국에서는 텔레그램이 가장 마찰 없음.
- 웨어러블: **Omi 펜던트** 공식 연동, **Rokid Glasses용 클라이언트 "clawsses"** 존재(박사님 장비와 직결!), 갤럭시워치(Wear OS) 가이드도 있음.
- 로컬 모델: `~/.openclaw/openclaw.json`에 OpenAI 호환 엔드포인트 등록으로 지원. 단, 공식 문서가 "쾌적한 에이전트 루프에는 맥스튜디오 2대+급(~$30k) 하드웨어 권장"이라 할 만큼 무겁습니다 — **8×3090 서버가 있는 박사님은 이 조건을 충족하는 드문 경우**입니다.

```json5
// ~/.openclaw/openclaw.json — 로컬 vLLM 연결
{
  agents: { defaults: { model: { primary: "local/qwen3-235b" } } },
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://192.168.100.1:8000/v1",
        apiKey: "none", api: "openai-completions",
        models: [{ id: "qwen3-235b", contextWindow: 131072, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }]
      }
    }
  }
}
```

- 주의(라이선스): Claude Pro/Max 구독 OAuth 토큰을 OpenClaw에 넣는 것은 Anthropic이 2026년 1월부터 차단·금지. **API 키 또는 로컬 모델**을 쓰세요.

## 8-4. 옵시디언 연동 — 3가지 방법

### 방법 1 (추천): 볼트 = 에이전트 작업폴더
OpenClaw의 메모리는 전부 마크다운(`~/.openclaw/workspace/MEMORY.md`, `memory/YYYY-MM-DD.md`)이므로, **옵시디언에서 이 폴더를 볼트로 열면 끝**. 에이전트가 쓰는 기억을 사람이 옵시디언에서 읽고 고치고, 옵시디언에 적은 노트가 에이전트 지식이 됨. 원격 서버면 Syncthing/git으로 볼트 동기화.

### 방법 2: 내장 옵시디언 스킬
OpenClaw 기본 탑재. 옵시디언 1.12.7+에서 설정→CLI 활성화 필요, 앱이 켜져 있어야 함. 노트 읽기/검색/생성/수정, 데일리노트, 태스크, 링크 조작.

### 방법 3: MCP 서버
`cyanheads/obsidian-mcp-server`(Local REST API 플러그인 연동)를 mcporter로 설치. 구조화된 read_note/create_note/edit_note 도구 제공.

### Hermes 쪽 옵시디언
Hermes Agent는 **파일시스템 기반 옵시디언 스킬 내장** — 앱 실행 불필요(헤드리스 서버에 최적), `OBSIDIAN_VAULT_PATH` 환경변수만 지정, [[위키링크]] 인식. **서버에서 돌리는 박사님 구성에는 이쪽이 더 깔끔**합니다.

## 8-5. Hermes Agent (헤르메스) — OpenClaw과 비교와 연동

| | OpenClaw | Hermes Agent (Nous Research) |
|---|---|---|
| 출시 | 2025.11 (Clawdbot) | 2026.2.25 |
| 규모 | 별 ~38만, 스킬 3,000~5,700개 | 별 17.5만(4개월), 스킬 652개 |
| 강점 | 채널 23종, 생태계 최대 | **자가 학습**(작업 경험→스킬 자동 생성), 로컬 모델 1급 지원, 보안 7중 설계 |
| 로컬 모델 | 되지만 무겁고 문서상 소극적 | `provider: custom` 공식 지원, 최소 64k 컨텍스트, vLLM `--tool-call-parser hermes` 명시 |
| 보안 | 사고 이력 (아래 8-7) | DM 페어링, 명령 사전검사(Tirith), 샌드박스, 프롬프트 인젝션 스캔 내장 |

```yaml
# Hermes config.yaml — 박사님 vLLM 서버 연결
model:
  provider: custom
  base_url: http://192.168.100.1:8000/v1
  context_length: 64000
fallback_providers:
  - provider: openrouter
    model: anthropic/claude-sonnet-4   # 어려운 작업은 클라우드로 폴백
```

- 설치: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`
- **OpenClaw → Hermes 마이그레이션 공식 지원**: `hermes claw migrate` (메모리, SOUL.md, 스킬, API 키 이전. `--dry-run`으로 미리보기)
- **공존 패턴 (한국 GPTers 커뮤니티 문서화)**: OpenClaw = 멀티채널 라우터/관문, Hermes = 실행·학습 엔진으로 나눠 ACP로 연결. 박사님의 "마이" 비서 구상과 정확히 맞는 구조입니다.

## 8-6. 지금 주목받는 에이전트 사례·뉴스 (2026 상반기)

### 성공 사례 (수치 있는 것만)
- **코딩**: GitHub에서 AI 에이전트 PR이 월 1,700만 건(6개월 새 4배). 병합률 83.8%. Devin(Cognition)은 1년 새 매출 13배($37M→$492M), 메르세데스-벤츠 레거시 현대화 8개월치를 8일에.
- **고객서비스**: Salesforce Agentforce — 자사 헬프포털 상담 85%를 사람 개입 없이 해결. 평균 ROI ~171%, 건당 비용 $1~2 (사람 $6~12).
- **법률 문서**: Harvey — 기업가치 $11B, 로펌들이 만든 커스텀 에이전트 2.5만 개, 조항 검토 30~60분→수 분. (박사님의 법률·정책자금 자동화 목표의 상용 버전)
- **개인 비서**: OpenClaw 사례 — 전용 Gmail 계정 격리 + 텔레그램으로 1시간 만에 구축, 메일 요약·"세컨드 브레인" 저장/검색.
- **업무 에이전트**: Claude Cowork(2026.1 데스크톱→7월 웹·모바일) — 비개발자용. 최대 사용처는 보고서·체크리스트·스프레드시트 대사(33.4%).

### 판도 뉴스
- **MCP가 표준 승리**: 2025.12 리눅스 재단 산하 Agentic AI Foundation에 기증. 월 SDK 다운로드 ~9,700만. 공식 레지스트리 서버 ~9,650개.
- **Agent Skills도 공개 표준화**(agentskills.io) — Claude에서 시작해 40여 제품이 채택.
- OpenAI는 Atlas 브라우저·Agent Builder를 접고 ChatGPT 본체와 기업용 Frontier로 통합. 구글은 Gemini CLI를 접고 **Antigravity**로 통일.
- 국내: 카카오 **Kanana**(카톡 탑재), 네이버 **Agent N**, 삼성·SK·LG 전사 사내 에이전트 배포(2026.6~), 소버린 AI 사업에서 LG(K-EXAONE)·SKT·업스테이지 진출.

### 오케스트레이션 프레임워크 (실사용 기준)
- **LangGraph** = 프로덕션 1위(대기업 아키텍처 문서 인용 34%). **CrewAI** = 빠른 프로토타이핑. **AutoGen은 유지보수 모드(신규 비추)**. Claude Code는 서브에이전트→에이전트 팀→워크플로로 진화. "프레임워크 없이 Agent SDK로 직접" 파도 큼.

## 8-7. 보안 — 반드시 지킬 것

2026년 상반기 실제 사고들:
- OpenClaw 게이트웨이 **3만 대 이상 인터넷 노출**(인증 없음 다수), 웹페이지 1클릭 원격코드실행(CVE-2026-25253), ClawHub에 **악성 스킬 수백~1,184개**(가짜 트레이딩 스킬이 macOS 인포스틸러 설치 등).
- Clinejection 사건: GitHub 이슈 제목의 프롬프트 인젝션 → 개발자 4,000명 감염. LiteLLM PyPI 공급망 공격(3시간, 4.7만 다운로드).
- 프롬프트 인젝션은 "패치 불가능한 구조적 문제"라는 게 업계 합의 (Simon Willison의 "치명적 3요소": 개인정보 접근 + 신뢰불가 콘텐츠 + 외부 전송 — 셋이 한 에이전트에 모이면 위험).

박사님 환경 수칙:
1. 게이트웨이(18789)를 절대 공인 IP에 열지 않기 → **Tailscale로만 접근**
2. DM 정책은 pairing(기본값) 유지 — 모르는 사람이 봇에 말 걸 수 없게
3. ClawHub/스킬은 설치 전 SKILL.md를 읽고 검증 (스킬이 임의 셸 명령 실행 가능)
4. 메일 등 신뢰불가 입력을 읽는 에이전트는 **전용 계정 + 도구 제한 + Docker 샌드박스**로 격리
5. `openclaw security audit --deep`를 설정 변경 때마다 실행

## 8-8. 박사님을 위한 단계별 적용 로드맵

1. **1주차 — 시연 가능한 최소 구성**: B컴퓨터에 GLM-4.5-Air(vLLM, `--tool-call-parser glm45`) + Hermes Agent 설치 → 텔레그램 연결 → 옵시디언 볼트 경로 지정. 이것만으로 "카톡하듯 말 걸면 노트에 기록하고 검색해주는 마이 1호" 완성.
2. **2주차 — 음성 파이프라인**: 갤럭시워치/Rokid 녹음 → faster-whisper(2080Ti) → 에이전트가 요약·분류 → 옵시디언 데일리노트 저장 (Rokid용 clawsses 클라이언트 실험).
3. **3주차 — 업무 스킬**: 일정(캘린더 MCP), 고객 관리, 트레이닝 암묵지 RAG(Qwen3-Embedding + 리랭커)를 스킬/MCP로 추가.
4. **4주차~ — 하이브리드**: LiteLLM 라우팅으로 민감/일상 작업은 로컬, 법률 초안 등 고난도 작업은 Claude API 폴백. 크론으로 아침 브리핑 자동화.

## 참고자료 (핵심만)

- OpenClaw: https://github.com/openclaw/openclaw / 문서: https://docs.openclaw.ai (로컬모델: docs/gateway/local-models.md, 보안: docs/gateway/security)
- OpenClaw 옵시디언 스킬: https://github.com/openclaw/openclaw/blob/main/skills/obsidian/SKILL.md
- Hermes Agent: https://github.com/NousResearch/hermes-agent / 옵시디언 스킬·로컬모델·마이그레이션 문서: hermes-agent.nousresearch.com/docs
- OpenClaw↔Hermes 비교(한국어): https://turingpost.co.kr/p/hermes-openclaw / GPTers 공존 가이드: https://www.gpters.org/nocode/post/open-claw-hermes-ready-MHZaLBBsgCWL06S
- Rokid Glasses 클라이언트: https://github.com/dweddepohl/clawsses
- 카카오톡 채널 플러그인: https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin
- vLLM 도구호출 문서: https://docs.vllm.ai/en/stable/features/tool_calling/
- Hermes 함수호출 형식(원조): https://github.com/NousResearch/Hermes-Function-Calling
- BFCL 리더보드: https://gorilla.cs.berkeley.edu/leaderboard.html
- OpenClaw 보안 사고 분석: https://hivesecurity.gitlab.io/blog/openclaw-ai-agent-security-crisis-2026/
- MCP 재단 이관: https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation
- 에이전트 벤치마크 주의(버클리 리워드해킹 연구): https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/

> 수치 주의: 일부 벤치마크 숫자는 벤더 자체 보고이거나 집계 사이트 기준이라 하니스에 따라 달라질 수 있습니다. 특히 에이전트 벤치마크는 2026년 버클리 연구에서 8대 벤치마크 전부가 리워드 해킹으로 뚫린 사례가 있어, 실제 도입 전 자기 업무로 직접 테스트하는 것이 중요합니다.

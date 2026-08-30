# 맥 2대 병행 개발 — 사무실 Mac Studio 50% / MacBook 50%

> 전체 인프라(스테이션 포함) 설계는 **`FLEET.md`** 를 먼저 보세요.
> 이 문서는 맥 2대(T0/T1) 사이의 동기화 실무만 다룹니다.

## 0. 핵심 판단

50/50이면 **"Mac Studio=서버, MacBook=단말"** 구조는 쓰면 안 됩니다.
그 구조는 MacBook이 오프라인이거나 사무실 네트워크가 죽는 순간 개발이 멈춥니다.
이동 중·집·카페에서 절반을 작업한다면 MacBook은 **자립 가능**해야 합니다.

반대로 양쪽을 완전히 독립시키면 이번엔 "어느 쪽이 최신인지" 문제가 매일 발생합니다.

→ 답은 **계층별로 다르게 처리하는 것**입니다.

## 1. 계층별 동기화 전략

| 계층 | 방식 | 이유 |
|---|---|---|
| **소스코드** | git (원격 = GitHub) | 이미 정답. 브랜치로 기기 간 인계 |
| **에이전트 설정·프롬프트** | git (이 저장소) | 버전 관리 필요, 용량 작음 |
| **[마이]의 기억(memory/)** | **별도 private 저장소** + 호스트별 파일 분리 | 개인정보. 공개 저장소에 절대 두지 않음 |
| **모델 가중치** | ❌ **동기화 금지** — 각 기기가 개별 보유 | 수 GB~수십 GB. 네트워크로 옮길 이유 없음 |
| **`mai.env` / 비밀값** | ❌ git 미추적. 기기별 수동 관리 | 경로·포트·모델이 기기마다 다름 |
| **개발 도구 목록** | `Brewfile` (git) | `brew bundle` 한 방으로 환경 동일화 |
| **언어 런타임 버전** | `mise` / `.tool-versions` (git) | Node/Python 버전 불일치가 최대 버그원 |

## 2. 모델 배치 — 확정

```
┌─ Mac Studio M3 Ultra 96GB (사무실, 상시) ─┐   ┌─ MacBook M3 Max 64GB (이동) ────┐
│                                           │   │                                 │
│  [마이] Qwen3 32B 4bit  ← 상시 상주       │   │  [마이] Qwen3 27B abliterated   │
│  70B 4bit               ← 온디맨드        │   │        MLX 4bit ← 상시 상주     │
│  LiteLLM 라우터 :4000                     │   │  (+ 임베딩 모델 — 오프라인 RAG) │
│         │                                 │   │         │                       │
│         └── Station A/B (192GB VRAM ×2)   │◀──┼─────────┘  큰 작업은 원격 위임  │
└───────────────────────────────────────────┘VPN└─────────────────────────────────┘
```

- **양쪽 모두 로컬 모델 상주** → 네트워크가 없어도 [마이]는 항상 살아 있음.
- **96GB > 64GB 이므로 Mac Studio가 상위 허브**. 대형 모델과 라우터를 여기서 호스팅합니다.
- 그보다 큰 모델(235B급)은 맥이 아니라 **GPU 스테이션**의 몫입니다 (`FLEET.md` 3절).
- **폴백 규칙**: LiteLLM이 스테이션 → Mac Studio → MacBook 순으로 자동 강등합니다.

## 3. 네트워크 — Tailscale

기기 간 연결은 **Tailscale**로 통일합니다. 포트포워딩·고정 IP·DDNS 전부 불필요하고,
카페 와이파이에서도 사무실 Mac Studio와 스테이션에 안전하게 붙습니다.

```bash
brew install --cask tailscale     # 양쪽 모두
# 로그인 후 MagicDNS 활성화 → macstudio.<tailnet>.ts.net 로 접근 가능
```

**보안 원칙은 그대로 유지합니다.** 추론 서버는 계속 `127.0.0.1` 에만 바인딩하고,
외부 노출은 Tailscale 계층에서만 처리합니다.

```bash
# Mac Studio에서: 루프백 서버를 tailnet 안에만 공개 (공용 인터넷 아님)
tailscale serve --bg --https=8443 http://127.0.0.1:11434
```

`tailscale funnel`(= 공용 인터넷 노출)은 **쓰지 마세요.** 인증 없는 LLM 서버가 통째로 열립니다.

## 4. 기억 동기화 — 별도 private 저장소 + 호스트 네임스페이스

### 4-1. 저장소를 분리하는 이유

**`drjinfit-ship-it/jinkim` 은 현재 public 입니다.** [마이]의 기억에는 일정·연락처·
프로젝트 맥락·때로는 자격증명 조각까지 섞여 들어갑니다. 공개 저장소에 커밋하면
되돌릴 수 없습니다 (git 이력에 영구히 남고, 이미 크롤링됨).

그래서 **2계층**으로 나눕니다.

| 저장소 | 가시성 | 내용 |
|---|---|---|
| `jinkim` (이곳) | public | 스크립트, 설계 문서, 설정 **템플릿** |
| `mai-memory` (신규) | **private** | `profile.md`, `journal/`, 진단 리포트 |

```bash
# Mac Studio에서 1회 — private 저장소 생성 후
cd ~/MAI/memory
git init && git remote add origin git@github.com:drjinfit-ship-it/mai-memory.git
git add -A && git commit -m "init" && git push -u origin main
```

`~/MAI/memory` 가 독립 저장소가 되므로, 이 public 저장소는 그 폴더를 `.gitignore`
합니다. 진단 리포트(`reports/*.md`)도 홈 폴더 구조가 통째로 드러나므로 동일하게
private 쪽으로 보냅니다.

> 저장소를 통합하고 싶다면 `jinkim` 자체를 private 으로 전환하는 것이 더 단순합니다.
> Settings → General → Danger Zone → Change visibility. 그 경우 위 분리는 불필요합니다.

### 4-2. 호스트 네임스페이스

두 기기가 같은 날 같은 파일에 쓰면 git 충돌이 납니다. 파일명에 호스트를 넣어 원천 차단합니다.

```
memory/
├── profile.md                        # 공유. 사람이 직접 편집 (충돌 시 수동 병합)
└── journal/
    ├── 2026-08-30.macstudio.md       # Mac Studio가 쓴 것
    └── 2026-08-30.macbook.md         # MacBook이 쓴 것  → 절대 충돌 안 남
```

`profile.md`만 공유 파일인데, 갱신 빈도가 낮아 실무상 문제가 되지 않습니다.

## 5. 기기 전환 의례 (Handoff)

가장 중요한 습관입니다. **자리를 뜰 때 30초, 앉을 때 10초.**

```bash
mai handoff     # 떠날 때: 미저장 작업을 wip 커밋 → push → 기억 동기화
mai resume      # 앉을 때: pull → 기억 동기화 → 마지막 작업 요약 출력
```

`scripts/sync-memory.sh` 가 실제 동기화를 수행하며, `mai resume` 은 반대쪽 기기가
남긴 저널을 [마이]에게 읽혀 "지난번에 어디까지 했는지"를 요약해 줍니다.

### 절대 하지 말 것
- **iCloud Drive / Dropbox 위에 git 저장소를 두는 것.** `.git` 내부 파일이 부분 동기화되면
  저장소가 조용히 깨집니다. 코드 동기화는 반드시 git remote로.
- 두 기기에서 같은 브랜치에 force push.

## 6. 환경 동일화

```bash
# Mac Studio(기준기)에서 현재 설치 목록 추출
brew bundle dump --file=Brewfile --force --describe

# MacBook에서 그대로 재현
brew bundle install --file=Brewfile
```

언어 런타임은 `mise` 로 고정해 두 기기의 버전을 일치시킵니다.

```bash
brew install mise
mise use -g node@22 python@3.12    # .tool-versions 를 git으로 공유
```

**경로도 통일하세요.** 양쪽 모두 `~/dev/` 를 작업 루트, `~/MAI/` 를 에이전트 루트로.
경로가 다르면 스크립트·설정이 기기마다 갈라지기 시작합니다.

## 7. Mac Studio 상시 운영 설정

사무실 Mac Studio는 24시간 대기해야 [마이] 허브와 LiteLLM 라우터가 의미를 가집니다.

```bash
sudo pmset -a sleep 0 disksleep 0 powernap 1   # 시스템 절전 해제
sudo systemsetup -setrestartpowerfailure on    # 정전 복구 시 자동 부팅
```

- **시스템 설정 → 사용자 및 그룹 → 자동 로그인 켜기**
  (LaunchAgent는 로그인 후에 뜨므로, 이게 없으면 재부팅 후 [마이]가 안 살아납니다)
- **시스템 설정 → 일반 → 공유 → 원격 로그인(SSH) + 화면 공유 켜기**
- FileVault를 켠 상태면 재부팅 후 자동 로그인이 막힙니다. 물리 보안이 확보된
  사무실이면 트레이드오프를 감안해 결정하세요.

## 8. 구축 순서

0. `mai-memory` private 저장소 생성 (또는 `jinkim` 을 private 으로 전환)
1. 양쪽에서 `scripts/01-inspect-mac.sh` 실행 → 리포트 2개 확보
2. Tailscale 설치 및 전 기기 연결
3. `Brewfile` + `mise` 로 환경 동일화
4. 양쪽에 `~/MAI` 생성, 8B 모델 로컬 상주
5. Mac Studio에 라우터 + `tailscale serve`
6. `mai handoff` / `mai resume` 습관화

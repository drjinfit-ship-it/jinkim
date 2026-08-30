# jinkim — 포터블 상시 에이전트 [마이]

로컬 LLM 기반 상시 개인 비서 **[마이]** 와 이를 뒷받침하는 자체 인프라의
설정·스크립트 저장소.

| 계층 | 기기 |
|---|---|
| T0 | MacBook Pro M3 Max / 64GB / 2TB — 이동형 자립 노드 |
| T1 | Mac Studio M3 Ultra / 96GB / 1TB + 외장 2TB — 상시 허브 (마이그레이션 중) |
| T2 | Station A: EPYC 7542 + RTX 3090 ×8 (192GB VRAM, NVLink ×4) — 상시 서빙 |
| T2 | Station B: TR Pro 3975WX + RTX 3090 ×8 (192GB VRAM) — 학습·실험 |
| T3 | Claude Code / Codex / Antigravity — 프론티어 코딩 |

## 현재 단계

- [x] 저장소 구조 및 설계안 확정 → `docs/ARCHITECTURE.md`
- [x] 맥북 진단 스크립트 → `scripts/01-inspect-mac.sh`
- [x] 맥 2대 병행 개발 설계 → `docs/TWO-MACHINE.md`
- [x] 전체 플릿 5계층 설계 및 라우팅 정책 → `docs/FLEET.md`
- [x] GPU 스테이션 구축 실무 → `docs/GPU-STATIONS.md`
- [x] Qwen3.8-Flash-Next 배치 검토 → `docs/QWEN38-NEXT.md`
- [ ] **Mac Studio 마이그레이션 완료 검증** ← *지금 할 일*
- [ ] **전력·냉각 인프라 확보** ← *스테이션의 실제 전제조건*
- [ ] 런타임 부트스트랩 (`02-bootstrap.sh`)
- [ ] 모델 확정 및 다운로드 → `docs/MODEL-NOTES.md`
- [ ] launchd 상시 구동 등록
- [ ] [마이] 인격/기억 계층 구성

## 시작하기

맥북 터미널에서:

```bash
git clone https://github.com/drjinfit-ship-it/jinkim.git ~/MAI-setup
cd ~/MAI-setup
git checkout claude/macbook-m2-agent-setup-mbr2me
bash scripts/01-inspect-mac.sh
```

`reports/mac-report-<날짜>.md` 가 생성됩니다.

> ⚠️ **이 저장소는 public 입니다.** 리포트에는 홈 폴더 구조가 그대로 담기므로
> `reports/*.md` 는 `.gitignore` 처리되어 있습니다. 내용은 채팅에 직접 붙여넣거나,
> private 저장소(`docs/TWO-MACHINE.md` 4-1절)로 보내세요.

**Mac Studio 마이그레이션이 끝나면 그쪽에서도 실행하세요.**
Migration Assistant는 launchd 등록과 Homebrew 링크를 자주 깨뜨립니다.

> 진단 스크립트는 **읽기 전용**입니다. 설치·변경·네트워크 전송을 하지 않으며,
> 시리얼 번호·하드웨어 UUID·MAC 주소는 자동으로 마스킹됩니다.

## 문서

| 파일 | 내용 |
|---|---|
| `docs/ARCHITECTURE.md` | 폴더 레이아웃, 런타임 스택, 상시 구동/포터블 설계 |
| `docs/MODEL-NOTES.md` | 모델 후보 비교, 32GB 메모리 튜닝, 양자화 선택 |
| `docs/TWO-MACHINE.md` | Mac Studio / MacBook 50:50 병행 개발, 동기화 전략 |
| **`docs/FLEET.md`** | **최상위 설계** — 5계층 구조, 모델 배치, 작업 라우팅 정책 |
| `docs/GPU-STATIONS.md` | RTX 3090 ×8 ×2 — 전력·냉각·PCIe·NVLink·vLLM 실무 |
| `docs/QWEN38-NEXT.md` | Qwen3.8-Flash-Next 125B-A6B — 어디서 어떻게 돌릴 것인가 |
| `config/litellm.yaml` | 로컬 백엔드 통합 라우터 설정 |

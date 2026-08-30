# jinkim — 포터블 상시 에이전트 [마이]

MacBook Pro M2 Max / 32GB / 2TB 위에서 로컬 LLM 기반 상시 개인 비서 **[마이]** 를
운영하기 위한 설정·스크립트 저장소.

## 현재 단계

- [x] 저장소 구조 및 설계안 확정 → `docs/ARCHITECTURE.md`
- [x] 맥북 진단 스크립트 → `scripts/01-inspect-mac.sh`
- [ ] **진단 리포트 수집** ← *지금 할 일*
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

`reports/mac-report-<날짜>.md` 가 생성됩니다. 커밋해서 올리면
그 실제 데이터를 근거로 다음 단계를 구성합니다.

```bash
git add reports/ && git commit -m "chore: 맥북 진단 리포트" && git push
```

> 진단 스크립트는 **읽기 전용**입니다. 설치·변경·네트워크 전송을 하지 않으며,
> 시리얼 번호·하드웨어 UUID·MAC 주소는 자동으로 마스킹됩니다.

## 문서

| 파일 | 내용 |
|---|---|
| `docs/ARCHITECTURE.md` | 폴더 레이아웃, 런타임 스택, 상시 구동/포터블 설계 |
| `docs/MODEL-NOTES.md` | 모델 후보 비교, 32GB 메모리 튜닝, 양자화 선택 |

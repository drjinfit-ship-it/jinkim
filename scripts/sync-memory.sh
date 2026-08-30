#!/usr/bin/env bash
# sync-memory.sh — 기기 간 [마이] 기억/설정 동기화
# 사용법: bash scripts/sync-memory.sh [pull|push|sync]
#   pull  : 원격 → 로컬 (자리에 앉을 때)
#   push  : 로컬 → 원격 (자리를 뜰 때)
#   sync  : pull 후 push (기본값)
set -euo pipefail

# 기억은 별도 PRIVATE 저장소에서 관리합니다 (docs/TWO-MACHINE.md 4절).
# MAI_MEMORY_REPO 로 그 경로를 지정하세요. 기본값 ~/MAI/memory
MEMORY_REPO="${MAI_MEMORY_REPO:-$HOME/MAI/memory}"

[[ -d "$MEMORY_REPO/.git" ]] || {
  echo "기억 저장소가 없습니다: $MEMORY_REPO" >&2
  echo "docs/TWO-MACHINE.md 4-1절을 참고해 private 저장소를 먼저 만드세요." >&2
  exit 1
}
cd "$MEMORY_REPO"

MODE="${1:-sync}"
HOST="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

log() { printf '\033[1;36m[mai-sync]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[mai-sync] %s\033[0m\n' "$*" >&2; exit 1; }

# 네트워크 실패에 대비한 재시도 (2s → 4s → 8s → 16s)
retry_git() {
  local delay=2 attempt=1
  until git "$@"; do
    (( attempt >= 5 )) && die "git $* 실패 (5회 시도)"
    log "실패 — ${delay}초 후 재시도 ($attempt/4)"
    sleep "$delay"; delay=$(( delay * 2 )); attempt=$(( attempt + 1 ))
  done
}

do_pull() {
  log "원격에서 가져오는 중 ($BRANCH)"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log "로컬 변경사항 발견 → 자동 stash"
    git stash push -u -m "mai-sync-autostash-$(date +%s)" >/dev/null
    local stashed=1
  fi
  retry_git pull --rebase origin "$BRANCH"
  if [[ "${stashed:-0}" == 1 ]]; then
    log "stash 복원"
    git stash pop || die "stash 복원 충돌 — 수동으로 해결하세요: git status"
  fi
}

do_push() {
  # 기억 파일은 호스트별로 분리되어 있어 충돌이 나지 않음
  if git status --porcelain | grep -q .; then
    log "변경사항 커밋 ($HOST)"
    git add -A
    git commit -q -m "chore(mai): $HOST 기억/설정 동기화 $(date '+%Y-%m-%d %H:%M')"
  else
    log "커밋할 변경사항 없음"
  fi
  log "원격으로 보내는 중 ($BRANCH)"
  retry_git push -u origin "$BRANCH"
}

# 오늘자 저널 파일을 호스트 네임스페이스로 보장
ensure_journal() {
  local j="journal/$(date +%Y-%m-%d).$HOST.md"
  if [[ ! -f "$j" ]]; then
    mkdir -p "$(dirname "$j")"
    printf '# %s — %s\n\n' "$(date '+%Y-%m-%d')" "$HOST" > "$j"
    log "저널 생성: $j"
  fi
}

# 반대편 기기가 남긴 최근 저널 요약 출력
show_other_side() {
  local latest
  latest="$(ls -1t journal/*.md 2>/dev/null \
            | grep -v "\.$HOST\.md$" | head -1 || true)"
  [[ -z "$latest" ]] && return 0
  printf '\n\033[1;33m── 다른 기기의 마지막 기록: %s ──\033[0m\n' "$(basename "$latest")"
  head -30 "$latest"
  printf '\033[1;33m────────────────────────────────\033[0m\n\n'
}

case "$MODE" in
  pull) do_pull; ensure_journal; show_other_side ;;
  push) ensure_journal; do_push ;;
  sync) do_pull; ensure_journal; do_push; show_other_side ;;
  *)    die "알 수 없는 모드: $MODE (pull|push|sync)" ;;
esac

log "완료 — $HOST @ $BRANCH"

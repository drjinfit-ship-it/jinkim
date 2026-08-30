#!/usr/bin/env bash
# 01-inspect-mac.sh — 맥북 구성/폴더 상태 진단 리포트 생성기
# 사용법:  bash scripts/01-inspect-mac.sh
# 결과:    reports/mac-report-<날짜>.md  (민감정보는 자동 마스킹)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/reports"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/mac-report-$(date +%Y%m%d-%H%M).md"

have() { command -v "$1" >/dev/null 2>&1; }
sec()  { printf '\n## %s\n\n' "$1" >> "$OUT"; }
code() { printf '```\n' >> "$OUT"; cat >> "$OUT"; printf '```\n' >> "$OUT"; }
kv()   { printf -- '- **%s**: %s\n' "$1" "${2:-N/A}" >> "$OUT"; }

# 시리얼/UUID/SSID 등 식별정보 마스킹
redact() {
  sed -E \
    -e 's/(Serial Number[^:]*:).*/\1 [REDACTED]/I' \
    -e 's/(Hardware UUID:).*/\1 [REDACTED]/I' \
    -e 's/(Provisioning UDID:).*/\1 [REDACTED]/I' \
    -e 's/(Apple ID[^:]*:).*/\1 [REDACTED]/I' \
    -e 's/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/[MAC-REDACTED]/g'
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "이 스크립트는 macOS에서 실행해야 합니다. (현재: $(uname -s))" >&2
  exit 1
fi

{
  echo "# 맥북 진단 리포트"
  echo
  echo "- 생성 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- 호스트: $(scutil --get LocalHostName 2>/dev/null || hostname)"
} > "$OUT"

# ── 1. 하드웨어 ──────────────────────────────────────────────
sec "1. 하드웨어"
system_profiler SPHardwareDataType 2>/dev/null | redact | code
kv "아키텍처" "$(uname -m)"
kv "물리 코어" "$(sysctl -n hw.physicalcpu 2>/dev/null)"
kv "논리 코어" "$(sysctl -n hw.logicalcpu 2>/dev/null)"
kv "성능 코어" "$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null)"
kv "효율 코어" "$(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null)"
kv "RAM(GB)" "$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))"
kv "GPU wired limit(MB)" "$(sysctl -n iogpu.wired_limit_mb 2>/dev/null || echo '0 (기본=RAM의 약 75%)')"

sec "1-1. GPU / Metal"
system_profiler SPDisplaysDataType 2>/dev/null | redact | head -40 | code

# ── 2. OS ───────────────────────────────────────────────────
sec "2. 운영체제"
sw_vers | code
kv "커널" "$(uname -r)"
kv "Rosetta 설치" "$([ -f /Library/Apple/usr/share/rosetta/rosetta ] && echo yes || echo no)"
kv "SIP" "$(csrutil status 2>/dev/null | sed 's/^.*status: //')"
kv "FileVault" "$(fdesetup status 2>/dev/null | head -1)"

# ── 3. 저장장치 ──────────────────────────────────────────────
sec "3. 저장장치 / 볼륨"
df -h | code
sec "3-1. 물리 디스크"
diskutil list 2>/dev/null | redact | code
sec "3-2. 외장 볼륨 (포터블 후보)"
ls -1 /Volumes 2>/dev/null | code

# ── 4. 홈 폴더 구조 ──────────────────────────────────────────
sec "4. 홈 폴더 상태"
echo "### 최상위 항목" >> "$OUT"
ls -la "$HOME" 2>/dev/null | code
echo "### 용량 상위 20개 (1단계 깊이)" >> "$OUT"
du -sh "$HOME"/* 2>/dev/null | sort -hr | head -20 | code
echo "### 개발/작업 폴더 후보" >> "$OUT"
for d in Developer Projects Documents Downloads Desktop code work git repos; do
  [ -d "$HOME/$d" ] && printf -- '- `~/%s` — %s, 하위 %s개\n' \
    "$d" "$(du -sh "$HOME/$d" 2>/dev/null | cut -f1)" \
    "$(ls -1 "$HOME/$d" 2>/dev/null | wc -l | tr -d ' ')" >> "$OUT"
done
echo >> "$OUT"
echo "### iCloud Drive" >> "$OUT"
if [ -d "$HOME/Library/Mobile Documents/com~apple~CloudDocs" ]; then
  printf -- '- 활성 — %s\n' "$(du -sh "$HOME/Library/Mobile Documents/com~apple~CloudDocs" 2>/dev/null | cut -f1)" >> "$OUT"
else
  printf -- '- 미사용\n' >> "$OUT"
fi

# ── 5. 개발 환경 ─────────────────────────────────────────────
sec "5. 개발 환경"
{
  for t in brew git python3 pip3 uv node npm pnpm bun go rustc cargo docker java; do
    if have "$t"; then
      printf -- '- **%s**: `%s` — %s\n' "$t" "$(command -v "$t")" \
        "$("$t" --version 2>&1 | head -1)"
    else
      printf -- '- **%s**: 미설치\n' "$t"
    fi
  done
} >> "$OUT"
kv "Xcode CLT" "$(xcode-select -p 2>/dev/null || echo '미설치')"
kv "Homebrew prefix" "$(brew --prefix 2>/dev/null || echo 'N/A')"
kv "Shell" "$SHELL"

# ── 6. 로컬 LLM 스택 현황 ────────────────────────────────────
sec "6. 로컬 LLM 스택"
{
  for t in ollama llama-server llama-cli mlx_lm.generate lms vllm; do
    have "$t" && printf -- '- **%s**: `%s`\n' "$t" "$(command -v "$t")" \
                || printf -- '- **%s**: 미설치\n' "$t"
  done
  for app in "/Applications/LM Studio.app" "/Applications/Ollama.app" "/Applications/Jan.app"; do
    [ -d "$app" ] && printf -- '- **%s**: 설치됨\n' "$(basename "$app")"
  done
} >> "$OUT"

echo "### 모델 캐시 용량" >> "$OUT"
{
  for p in "$HOME/.ollama/models" "$HOME/.cache/huggingface" "$HOME/.cache/lm-studio" \
           "$HOME/.lmstudio" "$HOME/Library/Application Support/Ollama"; do
    [ -e "$p" ] && printf -- '- `%s` — %s\n' "${p/#$HOME/\~}" "$(du -sh "$p" 2>/dev/null | cut -f1)"
  done
} >> "$OUT"

if have ollama; then
  echo "### ollama list" >> "$OUT"
  ollama list 2>&1 | code
fi

# ── 7. 상주 서비스 ───────────────────────────────────────────
sec "7. 사용자 상주 서비스 (launchd)"
ls -1 "$HOME/Library/LaunchAgents" 2>/dev/null | code
echo "### 실행 중 (mai/ollama/llama 관련)" >> "$OUT"
launchctl list 2>/dev/null | grep -Ei 'mai|ollama|llama|lmstudio' | code

# ── 8. 리소스 여유 ───────────────────────────────────────────
sec "8. 현재 리소스"
vm_stat 2>/dev/null | head -8 | code
kv "메모리 압박" "$(memory_pressure 2>/dev/null | tail -1)"
kv "스왑" "$(sysctl -n vm.swapusage 2>/dev/null)"
kv "가동시간" "$(uptime | sed 's/^ *//')"

echo >> "$OUT"
echo "---" >> "$OUT"
echo "_생성: scripts/01-inspect-mac.sh_" >> "$OUT"

echo "✅ 리포트 생성 완료: $OUT"
echo
echo "다음 단계:"
echo "  git add reports/ && git commit -m 'chore: 맥북 진단 리포트' && git push"

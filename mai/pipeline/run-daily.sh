#!/usr/bin/env bash
# 하루 마감 배치 — 전사 → 추출 → 종합 → 브리프
# launchd로 매일 저녁 실행하거나 수동으로 돌린다.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
DATE="${1:-$(date +%F)}"

echo "▶ $DATE 파이프라인 시작"
python3 transcribe.py  "$DATE"
python3 extract.py     "$DATE"
python3 synthesize.py  "$DATE"
python3 report.py      "$DATE"
echo "▶ 완료"

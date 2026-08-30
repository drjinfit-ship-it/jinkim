"""1차 추출 — 전사 세그먼트에서 구조화 정보를 뽑는다.

Station A(27B ×8 replica)로 병렬 처리한다. 저비용 대량 구간.
"""
from __future__ import annotations
import concurrent.futures as cf, datetime as dt, json, pathlib, sys
from common import EXTRACT, TRANSCRIPT, append_jsonl, chat, load_jsonl, parse_json

SYSTEM = """너는 녹취 분석기다. 주어진 대화 세그먼트에서 사실만 추출한다.

규칙:
- 추측하지 마라. 명시적으로 언급된 것만 뽑는다.
- 확실하지 않으면 넣지 마라. 재현율보다 정밀도가 중요하다.
- action_items의 type은 반드시 다음 중 하나:
  doc, research, code, schedule, analysis, contact, payment, deploy, delete, external, publish
- reversible은 그 일을 되돌릴 수 있으면 true. 발송·결제·배포·삭제는 항상 false.
- 반드시 JSON 객체 하나만 출력한다."""

TEMPLATE = """다음은 {date} {time} 의 대화 세그먼트다.

<세그먼트>
{text}
</세그먼트>

아래 스키마로 JSON을 출력하라. 해당 없는 항목은 빈 배열로 둔다.

{{
  "topic": "이 세그먼트의 주제 한 줄",
  "decisions": [{{"what": "결정 내용", "who": "결정한 사람", "confidence": 0.0}}],
  "action_items": [{{"task": "할 일", "owner": "담당", "due": "YYYY-MM-DD 또는 null",
                     "type": "위 목록 중 하나", "reversible": true, "urgency": "high|normal|low"}}],
  "commitments": [{{"what": "약속", "to_whom": "대상", "when": "시점"}}],
  "open_questions": ["답 없이 넘어간 질문"],
  "risks": ["언급된 위험·우려"],
  "tone": "평온|긴장|갈등|활기",
  "unresolved": ["매듭짓지 못한 사안"]
}}"""


def extract_one(seg: dict) -> dict:
    """세그먼트 하나를 구조화한다. 실패해도 파이프라인을 멈추지 않는다."""
    prompt = TEMPLATE.format(date=seg.get("date", ""), time=seg.get("time", ""),
                             text=seg["text"])
    try:
        out = parse_json(chat(prompt, model="mai-batch", system=SYSTEM,
                              temperature=0.1, json_mode=True))
    except Exception as e:                      # 한 세그먼트 실패로 하루를 버리지 않는다
        out = {"topic": "", "error": str(e), "action_items": [], "decisions": [],
               "commitments": [], "open_questions": [], "risks": [],
               "tone": "", "unresolved": []}
    out["segment_id"] = seg["segment_id"]
    out["speakers"] = seg.get("speakers", [])
    return out


def run(date: str, workers: int = 8) -> pathlib.Path:
    """하루치 전사를 병렬 추출한다. workers는 Station A의 replica 수에 맞춘다."""
    src = TRANSCRIPT / f"{date}.jsonl"
    segments = load_jsonl(src)
    if not segments:
        raise SystemExit(f"전사 파일이 비어 있습니다: {src}")

    out_path = EXTRACT / f"{date}.jsonl"
    out_path.unlink(missing_ok=True)

    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        for i, result in enumerate(pool.map(extract_one, segments), 1):
            append_jsonl(out_path, result)
            print(f"  [{i}/{len(segments)}] {result.get('topic', '')[:50]}", flush=True)

    print(f"✅ 추출 완료: {out_path}")
    return out_path


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat())

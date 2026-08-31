"""2차 종합 — 하루치를 한 컨텍스트에 넣고 서사·모순·의견을 만든다.

Mac Studio의 27B(262K 컨텍스트)를 쓴다. 27B도 64층 중 48층이 Gated
DeltaNet 선형 어텐션이라 KV가 상수 상태로 압축된다. 세그먼트 요약만으로는
보이지 않는 것 — 오전과 오후의 모순, 반복되는 미해결 — 이 여기서 잡힌다.

주의: 10만 토큰 prefill은 수 분 걸린다. 실시간이 아니라 마감 배치로 돌린다.
"""
from __future__ import annotations
import datetime as dt, json, sys
from common import EXTRACT, SYNTH, chat, load_jsonl, parse_json

SYSTEM = """너는 사용자의 하루를 통째로 읽고 판단하는 참모다.

세그먼트별 요약을 나열하지 마라. 그건 이미 있다.
너의 일은 개별 세그먼트만 봐서는 보이지 않는 것을 찾는 것이다:
- 앞뒤가 충돌하는 발언이나 결정
- 제기됐지만 아무도 답하지 않고 넘어간 것
- 반복해서 나타나는 신호
- 사용자가 놓쳤을 법한 함의

의견은 근거와 함께 말하라. 근거 없는 조언은 쓰지 마라.
반드시 JSON 객체 하나만 출력한다."""

TEMPLATE = """{date} 하루치 분석 결과다. 세그먼트 {n}개.

<데이터>
{payload}
</데이터>

아래 스키마로 출력하라.

{{
  "narrative": "오늘 하루가 어떻게 흘렀는지 3~5문장",
  "contradictions": [{{"observation": "무엇이 충돌하는가", "evidence": ["근거 세그먼트 id"]}}],
  "dropped": [{{"what": "제기됐으나 답 없이 넘어간 것", "when": "세그먼트 id"}}],
  "patterns": [{{"signal": "반복 신호", "count": 0, "interpretation": "해석"}}],
  "opinions": [{{"point": "의견", "basis": "근거"}}],
  "priority_tomorrow": ["내일 먼저 처리할 것 (중요도순)"]
}}"""


def run(date: str) -> dict:
    rows = load_jsonl(EXTRACT / f"{date}.jsonl")
    if not rows:
        raise SystemExit(f"추출 결과가 없습니다: {date}")

    payload = json.dumps(rows, ensure_ascii=False, indent=1)
    prompt = TEMPLATE.format(date=date, n=len(rows), payload=payload)

    print(f"종합 중… 세그먼트 {len(rows)}개, 약 {len(payload)//3:,} 토큰 (수 분 소요)")
    result = parse_json(chat(prompt, model="mai", system=SYSTEM,
                             temperature=0.3, max_tokens=8192, timeout=1800))

    out = SYNTH / f"{date}.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"✅ 종합 완료: {out}")
    return result


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat())

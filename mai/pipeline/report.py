"""마감 브리프 생성 — "뭘 해뒀는지"를 먼저 보여준다."""
from __future__ import annotations
import datetime as dt, json, sys
from common import DRAFTS, EXTRACT, METRICS, MAI_HOME, SYNTH, append_jsonl, load_jsonl
import gate


def build(date: str) -> str:
    rows = load_jsonl(EXTRACT / f"{date}.jsonl")
    synth_path = SYNTH / f"{date}.json"
    synth = json.loads(synth_path.read_text()) if synth_path.exists() else {}

    actions = [a for r in rows for a in r.get("action_items", [])]
    auto, manual = gate.partition(actions)

    # 채택률 추적용 기록 — 이게 없으면 자동 실행 범위를 언제 넓혀도 되는지 알 수 없다
    append_jsonl(METRICS / "adoption.jsonl", {
        "date": date, "segments": len(rows),
        "actions": len(actions), "auto": len(auto), "manual": len(manual),
    })

    L = [f"# {date} 브리프", "",
         f"세그먼트 {len(rows)}개 · 액션 {len(actions)}개 "
         f"(자동 처리 {len(auto)} / 판단 필요 {len(manual)})", ""]

    if synth.get("narrative"):
        L += ["## 오늘", "", synth["narrative"], ""]

    L += [f"## ✅ 이미 해둔 것 ({len(auto)})", ""]
    for a in auto or [None]:
        if a is None:
            L.append("_없음_")
            break
        L.append(f"- **{a.get('task','')}** `{a.get('type','')}`")
        L.append(f"  - 되돌리기: {a['_verdict']['undo']}")
    L.append("")

    L += [f"## ⛔ 판단이 필요한 것 ({len(manual)})", ""]
    for a in manual or [None]:
        if a is None:
            L.append("_없음_")
            break
        due = f" (기한 {a['due']})" if a.get("due") else ""
        L.append(f"- **{a.get('task','')}**{due} — {a['_verdict']['reason']}")
    L.append("")

    for key, title in (("contradictions", "⚠️ 앞뒤가 맞지 않는 것"),
                       ("dropped", "🕳 답 없이 넘어간 것"),
                       ("patterns", "🔁 반복 신호"),
                       ("opinions", "💭 의견")):
        items = synth.get(key) or []
        if not items:
            continue
        L += [f"## {title}", ""]
        for it in items:
            head = it.get("observation") or it.get("what") or it.get("signal") or it.get("point")
            body = it.get("basis") or it.get("interpretation") or it.get("when") or ""
            L.append(f"- **{head}**" + (f" — {body}" if body else ""))
        L.append("")

    if synth.get("priority_tomorrow"):
        L += ["## 내일 먼저", ""]
        L += [f"{i}. {p}" for i, p in enumerate(synth["priority_tomorrow"], 1)]
        L.append("")

    return "\n".join(L)


def run(date: str) -> None:
    text = build(date)
    out = MAI_HOME / "reports" / f"{date}-brief.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    print(text)
    print(f"\n✅ 브리프: {out}")


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat())

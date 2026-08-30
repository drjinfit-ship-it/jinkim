"""가역성 게이트 — 되돌릴 수 없는 액션의 자동 실행을 구조적으로 차단한다.

핵심 원칙: 이 판단을 LLM에게 맡기지 않는다.
LLM이 무엇을 반환하든, 여기 명시되지 않은 것은 실행되지 않는다.
"""
from __future__ import annotations
from dataclasses import dataclass

# 자동 실행이 허용되는 액션 타입. 화이트리스트이며, 여기 없으면 전부 차단된다.
REVERSIBLE_TYPES = {
    "doc":      "문서·초안 생성 (파일 쓰기만)",
    "research": "조사·자료 수집·요약",
    "code":     "브랜치 생성·커밋·테스트 (푸시·머지 제외)",
    "schedule": "가능 시간 후보 계산 (초대 발송 제외)",
    "analysis": "데이터 분석·리포트 생성",
}

# 어떤 경우에도 자동 실행하지 않는다. 초안까지만 만들고 멈춘다.
IRREVERSIBLE_TYPES = {
    "contact":  "이메일·메시지 발송",
    "payment":  "결제·주문·계약",
    "deploy":   "프로덕션 배포",
    "delete":   "파일·레코드 삭제",
    "external": "외부 API 쓰기",
    "publish":  "공개 게시",
}


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    reason: str
    undo: str = ""       # 실행을 허용할 때, 되돌리는 방법
    draft_only: bool = False


def evaluate(action: dict) -> Verdict:
    """액션 하나를 판정한다. action은 extract.py가 만든 dict."""
    atype = (action.get("type") or "").strip().lower()

    if atype in IRREVERSIBLE_TYPES:
        return Verdict(False, f"비가역: {IRREVERSIBLE_TYPES[atype]}", draft_only=True)

    if atype not in REVERSIBLE_TYPES:
        # 모르는 타입은 차단한다. 화이트리스트가 아니면 통과시키지 않는다.
        return Verdict(False, f"미등록 타입 '{atype}' — 안전을 위해 차단", draft_only=True)

    # 모델이 reversible=false 를 달았다면 그 판단을 존중한다(더 보수적인 쪽으로만).
    if action.get("reversible") is False:
        return Verdict(False, "모델이 비가역으로 표시", draft_only=True)

    undo = {
        "doc":      "생성된 파일 삭제",
        "research": "생성된 노트 삭제",
        "code":     "git branch -D <브랜치> (푸시하지 않았으므로 로컬만 영향)",
        "schedule": "후보 목록 폐기 (캘린더 미변경)",
        "analysis": "생성된 리포트 삭제",
    }[atype]
    return Verdict(True, f"가역: {REVERSIBLE_TYPES[atype]}", undo=undo)


def partition(actions: list[dict]) -> tuple[list[dict], list[dict]]:
    """(자동 실행 대상, 사람 판단 대상) 으로 나눈다."""
    auto, manual = [], []
    for a in actions:
        v = evaluate(a)
        a["_verdict"] = {"allowed": v.allowed, "reason": v.reason, "undo": v.undo}
        (auto if v.allowed else manual).append(a)
    return auto, manual


if __name__ == "__main__":
    import json, sys
    actions = json.load(sys.stdin)
    auto, manual = partition(actions)
    print(json.dumps({"auto": auto, "manual": manual}, ensure_ascii=False, indent=2))

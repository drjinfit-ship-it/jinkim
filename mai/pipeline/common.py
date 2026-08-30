"""파이프라인 공통 — 라우터 클라이언트와 경로 규약."""
from __future__ import annotations
import json, os, pathlib, urllib.request, urllib.error

MAI_HOME = pathlib.Path(os.environ.get("MAI_HOME", pathlib.Path.home() / "MAI"))
ROUTER = os.environ.get("MAI_ROUTER_URL", "http://127.0.0.1:4000/v1")

INBOX      = MAI_HOME / "inbox" / "audio"
TRANSCRIPT = MAI_HOME / "data" / "transcripts"
EXTRACT    = MAI_HOME / "data" / "extracts"
SYNTH      = MAI_HOME / "data" / "synthesis"
DRAFTS     = MAI_HOME / "drafts"
METRICS    = MAI_HOME / "memory" / "metrics"

for _d in (INBOX, TRANSCRIPT, EXTRACT, SYNTH, DRAFTS, METRICS):
    _d.mkdir(parents=True, exist_ok=True)


def chat(prompt: str, *, model: str = "mai", system: str | None = None,
         temperature: float = 0.2, max_tokens: int = 4096,
         json_mode: bool = False, timeout: int = 600) -> str:
    """LiteLLM 라우터로 한 번 질의. 라우터가 계층 폴백을 처리한다."""
    messages = ([{"role": "system", "content": system}] if system else []) + \
               [{"role": "user", "content": prompt}]
    payload = {"model": model, "messages": messages,
               "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req = urllib.request.Request(
        f"{ROUTER}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"]
    except urllib.error.URLError as e:
        raise RuntimeError(f"라우터에 닿지 못했습니다 ({ROUTER}): {e}") from e


def parse_json(text: str) -> dict:
    """모델 출력에서 JSON을 건져낸다. 코드펜스를 흔히 붙이므로 벗겨낸다."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        t = t[4:] if t.startswith("json") else t
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"JSON을 찾지 못했습니다: {text[:200]}")
    return json.loads(t[start:end + 1])


def load_jsonl(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def append_jsonl(path: pathlib.Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

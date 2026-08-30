"""전사 — 오디오를 화자 라벨이 붙은 세그먼트 JSONL로 만든다.

⚠️ Phase 1의 전부다. 여기 품질이 안 나오면 상위 단계는 전부 무의미하다.
2주간은 이 단계만 돌리며 config/vocab.txt 를 채우는 데 집중하라.

백엔드는 교체 가능하다:
  MAI_STT_BACKEND=faster-whisper  (기본, Station B의 3090)
  MAI_STT_BACKEND=mlx-whisper     (맥 로컬, 오프라인)
"""
from __future__ import annotations
import datetime as dt, os, pathlib, subprocess, sys
from common import INBOX, MAI_HOME, TRANSCRIPT, append_jsonl

BACKEND   = os.environ.get("MAI_STT_BACKEND", "faster-whisper")
MODEL     = os.environ.get("MAI_STT_MODEL", "large-v3")
VOCAB     = MAI_HOME / "config" / "vocab.txt"
SEG_SEC   = int(os.environ.get("MAI_SEGMENT_SEC", "300"))   # 5분 단위


def initial_prompt() -> str:
    """도메인 어휘를 initial_prompt로 주입한다 — 전문용어 정확도의 절반이 여기서 갈린다."""
    if not VOCAB.exists():
        return ""
    words = [w.strip() for w in VOCAB.read_text().splitlines() if w.strip()
             and not w.startswith("#")]
    return ", ".join(words[:200])      # 너무 길면 오히려 품질이 떨어진다


def transcribe(audio: pathlib.Path) -> list[dict]:
    """오디오 한 파일 → 세그먼트 리스트.

    TODO(Phase 1): 아래를 실제 백엔드 호출로 채운다.
      faster-whisper:
        model = WhisperModel(MODEL, device="cuda", compute_type="float16")
        segs, _ = model.transcribe(str(audio), language="ko",
                                   initial_prompt=initial_prompt(),
                                   vad_filter=True, word_timestamps=True)
      화자분리:
        pyannote.audio Pipeline 으로 diarization 후 타임스탬프 교차 매칭
    """
    raise NotImplementedError(
        "STT 백엔드를 연결하세요. docs/AUTOMATION.md 2-2절 참조.\n"
        f"  backend={BACKEND} model={MODEL} vocab={'있음' if VOCAB.exists() else '없음'}"
    )


def run(date: str | None = None) -> None:
    date = date or dt.date.today().isoformat()
    out = TRANSCRIPT / f"{date}.jsonl"
    files = sorted(p for p in INBOX.glob("*") if p.suffix.lower()
                   in {".wav", ".m4a", ".mp3", ".opus", ".flac"})
    if not files:
        print(f"처리할 오디오가 없습니다: {INBOX}")
        return

    for audio in files:
        print(f"전사 중: {audio.name}")
        for seg in transcribe(audio):
            append_jsonl(out, seg)
        # 처리 완료분은 보관으로 옮겨 재처리를 막는다
        done = MAI_HOME / "data" / "audio" / date
        done.mkdir(parents=True, exist_ok=True)
        audio.rename(done / audio.name)

    print(f"✅ 전사 완료: {out}")


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else None)

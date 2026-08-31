"""전사 — 오디오를 화자 라벨이 붙은 세그먼트 JSONL로 만든다.

Mac Studio에서 상시 저전력으로 돈다 (docs/AUTOMATION.md 2-2절).

⚠️ Phase 1의 전부다. 여기 품질이 안 나오면 상위 단계는 전부 무의미하다.
2주간은 이 단계만 돌리며 config/vocab.txt 를 채우는 데 집중하라.

⚠️ 구현 선택이 하드웨어보다 중요하다. 같은 M3 Ultra에서 20배 차이 난다:
    mlx-whisper large-v3   2~3x 실시간  → 8시간에 3시간+  ❌
    large-v3-turbo MLX     9.1x         → 53분
    coreml (ANE)           22x          → 22분   ★ GPU 비경합
    whisperx-mlx           최대 52x     → 9분    ★ 최속

  ANE 경로는 Neural Engine을 쓰므로 GPU에 상주한 LLM과 경합하지 않는다.
  상시 운영에는 coreml 또는 whisperx-mlx 를 쓸 것.
"""
from __future__ import annotations
import datetime as dt, os, pathlib, subprocess, sys
from common import INBOX, MAI_HOME, TRANSCRIPT, append_jsonl

BACKEND   = os.environ.get("MAI_STT_BACKEND", "whisperx-mlx")
MODEL     = os.environ.get("MAI_STT_MODEL", "large-v3")
DIARIZE   = os.environ.get("MAI_DIARIZE_DEVICE", "mps")   # mps | cpu
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

      whisperx-mlx (권장, 최대 52x):
        import whisperx_mlx
        result = whisperx_mlx.transcribe(str(audio), model=MODEL, language="ko",
                                         initial_prompt=initial_prompt())

      coreml / ANE (GPU 비경합, 22x):
        Core ML 변환 모델을 ANE로 dispatch. GPU에 상주한 LLM과 경합하지 않는다.

      화자분리 (pyannote 3.1 — onnxruntime 제거되어 MPS 정상 동작):
        from pyannote.audio import Pipeline
        dia = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
        dia.to(torch.device(DIARIZE))        # mps: CPU 대비 약 9배 빠름
        turns = dia(str(audio))
        # turns 의 화자 구간과 whisper 타임스탬프를 교차 매칭해 speaker 라벨 부여
    """
    raise NotImplementedError(
        "STT 백엔드를 연결하세요. docs/AUTOMATION.md 2-2절 참조.\n"
        f"  backend={BACKEND} model={MODEL} diarize={DIARIZE} "
        f"vocab={'있음' if VOCAB.exists() else '없음'}"
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

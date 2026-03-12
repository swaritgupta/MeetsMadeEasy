import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import torch
import subprocess
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from pyannote.audio import Pipeline

APP_ROOT = Path(__file__).resolve().parent
load_dotenv(APP_ROOT / ".env")

MODEL_ID = os.getenv("PYANNOTE_MODEL", "pyannote/speaker-diarization-3.1")
PIPELINE: Optional[Pipeline] = None

app = FastAPI(title="Diarisation Service", version="1.0.0")


def _load_pipeline() -> Pipeline:
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_API_KEY")
    if not token:
        raise RuntimeError(
            "Missing Hugging Face token. Set HF_TOKEN or HUGGING_FACE_API_KEY."
        )
    pipeline = Pipeline.from_pretrained(MODEL_ID, use_auth_token=token)
    if torch.cuda.is_available():
        pipeline.to(torch.device("cuda"))
    return pipeline


@app.on_event("startup")
def startup() -> None:
    global PIPELINE
    PIPELINE = _load_pipeline()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "pipeline_loaded": PIPELINE is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "model": MODEL_ID,
    }


def _maybe_convert_to_wav(input_path: str, tmp_dir: str) -> str:
    suffix = Path(input_path).suffix.lower()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        if suffix != ".wav":
            raise HTTPException(
                status_code=400,
                detail="Only .wav files are supported unless ffmpeg is installed.",
            )
        return input_path

    output_path = os.path.join(tmp_dir, "audio-16k.wav")
    result = subprocess.run(
        [ffmpeg, "-y", "-i", input_path, "-ar", "16000", "-ac", "1", output_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.returncode != 0 or not os.path.exists(output_path):
        raise HTTPException(status_code=400, detail="Audio conversion failed.")
    return output_path


@app.post("/diarise")
async def diarise(
    file: UploadFile = File(...),
    min_speakers: Optional[int] = Query(default=None, ge=1),
    max_speakers: Optional[int] = Query(default=None, ge=1),
) -> dict:
    if PIPELINE is None:
        raise HTTPException(status_code=503, detail="Pipeline not initialized.")
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Audio file is required.")

    tmp_dir = tempfile.mkdtemp(prefix="diarise-")
    try:
        suffix = Path(file.filename).suffix or ".wav"
        input_path = os.path.join(tmp_dir, f"input{suffix}")
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        audio_path = _maybe_convert_to_wav(input_path, tmp_dir)
        diarization = PIPELINE(
            audio_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
        )

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(
                {
                    "speaker": speaker,
                    "start": round(turn.start, 3),
                    "end": round(turn.end, 3),
                }
            )

        return {"segments": segments}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)

# Diarisation Service (pyannote.audio)

FastAPI microservice for speaker diarisation using `pyannote.audio`.

## Prerequisites
- Python 3.10
- Hugging Face access token with acceptance of the model terms:
  - `pyannote/speaker-diarization-3.1`
- Optional: `ffmpeg` (required for non-WAV inputs)

## Setup
```bash
cd /Users/swaritgupta/Desktop/Meeting\ summarizer

python3.10 -m venv .venv
source .venv/bin/activate

pip install -r diarisation-service/requirements.txt
```

Set a token (either name is accepted):
```bash
export HF_TOKEN=your_token
# or
export HUGGING_FACE_API_KEY=your_token
```

You can also put the token in `diarisation-service/.env`:
```
HF_TOKEN=your_token
```

## Run
```bash
cd /Users/swaritgupta/Desktop/Meeting\ summarizer/diarisation-service
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Usage
```bash
curl -X POST "http://localhost:8001/diarise" \
  -F "file=@/path/to/audio.wav"
```

Optional speaker bounds:
```bash
curl -X POST "http://localhost:8001/diarise?min_speakers=2&max_speakers=4" \
  -F "file=@/path/to/audio.wav"
```

## Notes
- If `ffmpeg` is installed, non-WAV audio will be converted to 16kHz mono WAV.
- Without `ffmpeg`, only `.wav` files are accepted.

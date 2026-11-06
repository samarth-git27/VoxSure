import logging
import os
import re
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .analysis import inspect_transcript
from .evaluation import evaluate
from .providers import ProviderUnavailable, SAMPLE, configured_provider, provider_health, transcribe

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("voxsure.api")
MAX_UPLOAD_MB = int(os.getenv("VOXSURE_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".mp4", ".webm", ".flac", ".ogg", ".opus", ".aac", ".amr", ".aiff", ".wma"}
SIGNATURES = {
    ".wav": (b"RIFF",),
    ".mp3": (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"),
    ".m4a": (b"\x00\x00\x00",),
    ".mp4": (b"\x00\x00\x00",),
    ".webm": (b"\x1a\x45\xdf\xa3",),
    ".flac": (b"fLaC",),
    ".ogg": (b"OggS",),
    ".opus": (b"OggS",),
    ".aac": (b"\xff\xf1", b"\xff\xf9"),
    ".amr": (b"#!AMR",),
    ".aiff": (b"FORM",),
    ".wma": (b"\x30\x26\xb2\x75"),
}
LANGUAGES = {
    "auto": "unknown", "unknown": "unknown", "hi-IN": "hi-IN", "bn-IN": "bn-IN",
    "kn-IN": "kn-IN", "ml-IN": "ml-IN", "mr-IN": "mr-IN", "or-IN": "od-IN",
    "od-IN": "od-IN", "pa-IN": "pa-IN", "ta-IN": "ta-IN", "te-IN": "te-IN",
    "en-IN": "en-IN", "gu-IN": "gu-IN", "as-IN": "as-IN", "ur-IN": "ur-IN",
    "ne-IN": "ne-IN", "kok-IN": "kok-IN", "ks-IN": "ks-IN", "sd-IN": "sd-IN",
    "sa-IN": "sa-IN", "sat-IN": "sat-IN", "mni-IN": "mni-IN", "brx-IN": "brx-IN",
    "mai-IN": "mai-IN", "doi-IN": "doi-IN",
}


def _allowed_origins() -> list[str]:
    return [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "VOXSURE_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]


app = FastAPI(title="VoxSure API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


class Normalization(BaseModel):
    lowercase: bool = False
    strip_punctuation: bool = False
    normalize_whitespace: bool = True
    normalize_numbers: bool = False


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=False)

    reference: str = Field(max_length=100_000)
    hypothesis: str = Field(max_length=100_000)
    normalization: Normalization = Field(default_factory=Normalization)
    reference_entities: list[str] | None = Field(default=None, max_length=500)
    hypothesis_entities: list[str] | None = Field(default=None, max_length=500)
    reference_numbers: list[str] | None = Field(default=None, max_length=500)
    hypothesis_numbers: list[str] | None = Field(default=None, max_length=500)


@app.exception_handler(HTTPException)
async def http_error_handler(request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.warning("request_failed status=%s path=%s", exc.status_code, request.url.path)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)


@app.get("/api/health")
async def health():
    return {"status": "ok", "provider": provider_health(), "max_upload_mb": MAX_UPLOAD_MB}


@app.get("/api/providers")
async def providers():
    return {
        "provider": provider_health(),
        "supported_languages": [
            {"code": "unknown", "name": "Auto / code-mixed"},
            {"code": "hi-IN", "name": "Hindi"}, {"code": "bn-IN", "name": "Bengali"},
            {"code": "kn-IN", "name": "Kannada"}, {"code": "ml-IN", "name": "Malayalam"},
            {"code": "mr-IN", "name": "Marathi"}, {"code": "od-IN", "name": "Odia"},
            {"code": "pa-IN", "name": "Punjabi"}, {"code": "ta-IN", "name": "Tamil"},
            {"code": "te-IN", "name": "Telugu"}, {"code": "en-IN", "name": "English"},
            {"code": "gu-IN", "name": "Gujarati"}, {"code": "as-IN", "name": "Assamese"},
            {"code": "ur-IN", "name": "Urdu"}, {"code": "ne-IN", "name": "Nepali"},
        ],
    }


@app.get("/api/samples")
async def samples():
    return {
        **SAMPLE,
        "id": "sample-appointment-001",
        "created_at": "2026-10-29T00:00:00+00:00",
        "language_setting": "Auto / code-mixed",
        "duration_seconds": None,
        "provider": "Demo sample",
        "model": "VoxSure sample fixture",
        "status": "sample",
        "source": "sample_fixture",
        "confidence": None,
        "segments": None,
        "provider_request_id": None,
        "analysis": inspect_transcript(SAMPLE["transcript"]),
    }


@app.post("/api/evaluate")
async def evaluate_text(request: EvaluationRequest):
    return evaluate(
        request.reference,
        request.hypothesis,
        **request.normalization.model_dump(),
        reference_entities=request.reference_entities,
        hypothesis_entities=request.hypothesis_entities,
        reference_numbers=request.reference_numbers,
        hypothesis_numbers=request.hypothesis_numbers,
    )


def _valid_audio_header(extension: str, data: bytes) -> bool:
    if extension == ".m4a" or extension == ".mp4":
        return len(data) >= 12 and data[4:8] == b"ftyp"
    if extension == ".wav":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WAVE"
    return any(data.startswith(signature) for signature in SIGNATURES[extension])


@app.post("/api/transcriptions")
async def create_transcription(
    file: UploadFile = File(...),
    language: str = Form(default="unknown"),
    context: str = Form(default="", max_length=4000),
):
    original_filename = file.filename or "audio"
    normalized_filename = original_filename.replace("\\", "/").rsplit("/", 1)[-1]
    safe_filename = re.sub(r"[^A-Za-z0-9_.-]", "_", normalized_filename)[:180].strip("._") or "audio"
    try:
        extension = os.path.splitext(normalized_filename)[1].lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(415, "Choose a supported audio file (WAV, MP3, M4A, WebM, FLAC, OGG, AAC, AMR, AIFF, or WMA).")
        if language not in LANGUAGES:
            raise HTTPException(422, "Choose a supported language or Auto / code-mixed.")
        content_type = file.content_type or "application/octet-stream"
        if content_type != "application/octet-stream" and not content_type.startswith("audio/") and not (extension in {".m4a", ".mp4"} and content_type == "video/mp4"):
            raise HTTPException(415, "The uploaded file must have an audio media type.")

        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"Audio exceeds the {MAX_UPLOAD_MB} MB upload limit.")
        if len(data) < 12 or not _valid_audio_header(extension, data):
            raise HTTPException(415, "The file content does not match the selected audio format.")
        try:
            result = await transcribe(
                data,
                filename=safe_filename,
                content_type=content_type,
                language=LANGUAGES[language],
                context=context,
            )
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        except ProviderUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

        transcript = result["transcript"]
        logger.info(
            "transcription_completed provider=%s source=%s upload_bytes=%s",
            result["provider"],
            result["source"],
            len(data),
        )
        return {
            "id": str(uuid.uuid4()),
            "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "filename": safe_filename,
            "language_setting": language,
            "duration_seconds": None,
            "provider": result["provider"],
            "model": result["model"],
            "status": "completed",
            "source": result["source"],
            "label": result["label"],
            "transcript": transcript,
            "confidence": result["confidence"],
            "segments": result["segments"],
            "provider_request_id": result["provider_request_id"],
            "analysis": inspect_transcript(transcript),
        }
    finally:
        await file.close()

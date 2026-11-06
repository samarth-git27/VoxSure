import json
import logging
import os

import httpx

logger = logging.getLogger("voxsure.providers")


class ProviderUnavailable(Exception):
    pass


SAMPLE = {
    "label": "DEMO SAMPLE — curated text; no audio was processed",
    "transcript": "Namaskara, my appointment is on 14/08/2026 at 10:30. Please bring reference ID KA-4821.",
    "language": "en-IN",
    "filename": "sample-not-audio.wav",
}


def configured_provider() -> str:
    return os.getenv("VOXSURE_PROVIDER", "demo").strip().lower()


def provider_health() -> dict:
    provider = configured_provider()
    if provider == "demo":
        return {
            "mode": "demo",
            "available": True,
            "configured": True,
            "model": "VoxSure sample fixture",
            "reason": "Demo mode never processes uploaded audio.",
        }
    if provider == "sarvam":
        configured = bool(os.getenv("SARVAM_API_KEY"))
        return {
            "mode": "live",
            "provider": "Sarvam AI",
            "available": configured,
            "configured": configured,
            "model": "saaras:v4",
            "reason": None if configured else "SARVAM_API_KEY is not configured on the server.",
        }
    return {
        "mode": "unavailable",
        "available": False,
        "configured": False,
        "reason": "VOXSURE_PROVIDER must be demo or sarvam.",
    }


async def transcribe(
    audio: bytes,
    *,
    filename: str,
    content_type: str,
    language: str,
    context: str,
) -> dict:
    health = provider_health()
    if health["mode"] == "demo":
        return {
            "transcript": SAMPLE["transcript"],
            "provider": "Demo sample",
            "model": "VoxSure sample fixture",
            "language": SAMPLE["language"],
            "source": "demo_sample",
            "label": SAMPLE["label"],
            "confidence": None,
            "segments": None,
            "provider_request_id": None,
        }
    if health["mode"] != "live" or not health["available"]:
        raise ProviderUnavailable(health["reason"] or "Speech provider is not configured.")

    api_key = os.environ["SARVAM_API_KEY"]
    fields = {
        "model": "saaras:v4",
        "language_code": language or "unknown",
        "with_timestamps": "true",
    }
    keyterms = [term.strip() for term in context.splitlines() if term.strip()]
    if keyterms:
        if len(keyterms) > 50 or any(len(term) > 64 for term in keyterms):
            raise ValueError("Provide at most 50 glossary terms, each up to 64 characters.")
        fields["keyterms"] = json.dumps(keyterms, ensure_ascii=False)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": api_key},
                data=fields,
                files={"file": (filename, audio, content_type)},
            )
    except httpx.TimeoutException as exc:
        raise ProviderUnavailable("The speech provider timed out. Please try again.") from exc
    except httpx.RequestError as exc:
        logger.warning("sarvam_request_failed error_type=%s", type(exc).__name__)
        raise ProviderUnavailable("The speech provider could not be reached.") from exc

    if response.is_error:
        logger.warning("sarvam_response_error status=%s", response.status_code)
        if response.status_code == 429:
            raise ProviderUnavailable("The speech provider rate limit was reached.")
        if response.status_code >= 500:
            raise ProviderUnavailable("The speech provider is temporarily unavailable.")
        raise ProviderUnavailable(
            f"The speech provider rejected the request (HTTP {response.status_code})."
        )
    try:
        payload = response.json()
        transcript = payload["transcript"]
        if not isinstance(transcript, str):
            raise TypeError("transcript must be a string")
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning("sarvam_invalid_response error_type=%s", type(exc).__name__)
        raise ProviderUnavailable("The speech provider returned an invalid response.") from exc

    timestamp_payload = payload.get("timestamps")
    segments = None
    if isinstance(timestamp_payload, dict):
        words = timestamp_payload.get("words", [])
        starts = timestamp_payload.get("start_time_seconds", [])
        ends = timestamp_payload.get("end_time_seconds", [])
        if len(words) == len(starts) == len(ends):
            segments = [
                {"text": word, "start": start, "end": end}
                for word, start, end in zip(words, starts, ends, strict=True)
            ]
    return {
        "transcript": transcript,
        "provider": "Sarvam AI",
        "model": "saaras:v4",
        "language": payload.get("language_code") or language or "unknown",
        "source": "live_provider",
        "label": None,
        "confidence": payload.get("language_probability"),
        "segments": segments,
        "provider_request_id": payload.get("request_id"),
    }

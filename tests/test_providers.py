import asyncio

import httpx
import pytest

from backend import providers


def test_sarvam_uses_official_endpoint_auth_and_maps_real_response(monkeypatch):
    observed = {}

    class FakeResponse:
        is_error = False

        def json(self):
            return {
                "request_id": "provider-id",
                "transcript": "ನಮಸ್ಕಾರ Hello",
                "language_code": "kn-IN",
                "language_probability": 0.87,
                "timestamps": {
                    "words": ["ನಮಸ್ಕಾರ Hello"],
                    "start_time_seconds": [0.0],
                    "end_time_seconds": [1.2],
                },
            }

    class FakeClient:
        def __init__(self, **kwargs):
            observed["timeout"] = kwargs["timeout"]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, *, headers, data, files):
            observed.update(url=url, headers=headers, data=data, files=files)
            return FakeResponse()

    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "server-only-test-key")
    monkeypatch.setattr(providers.httpx, "AsyncClient", FakeClient)

    result = asyncio.run(
        providers.transcribe(
            b"audio-bytes",
            filename="clip.wav",
            content_type="audio/wav",
            language="unknown",
            context="New Delhi\nSupportDesk",
        )
    )

    assert observed["url"] == "https://api.sarvam.ai/speech-to-text"
    assert observed["headers"] == {"api-subscription-key": "server-only-test-key"}
    assert observed["data"]["model"] == "saaras:v4"
    assert observed["data"]["language_code"] == "unknown"
    assert observed["data"]["with_timestamps"] == "true"
    assert observed["data"]["keyterms"] == '["New Delhi", "SupportDesk"]'
    assert observed["files"]["file"] == ("clip.wav", b"audio-bytes", "audio/wav")
    assert result["transcript"] == "ನಮಸ್ಕಾರ Hello"
    assert result["provider"] == "Sarvam AI"
    assert result["confidence"] == 0.87
    assert result["segments"] == [
        {"text": "ನಮಸ್ಕಾರ Hello", "start": 0.0, "end": 1.2}
    ]
    assert result["provider_request_id"] == "provider-id"


def test_sarvam_does_not_invent_alignment_or_word_confidence(monkeypatch):
    class FakeResponse:
        is_error = False

        def json(self):
            return {"transcript": "", "language_code": None}

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "server-only-test-key")
    monkeypatch.setattr(providers.httpx, "AsyncClient", FakeClient)

    result = asyncio.run(
        providers.transcribe(
            b"audio", filename="clip.wav", content_type="audio/wav",
            language="unknown", context="",
        )
    )

    assert result["transcript"] == ""
    assert result["confidence"] is None
    assert result["segments"] is None
    assert result["provider_request_id"] is None


def test_sarvam_timeout_is_reported_without_request_payload(monkeypatch):
    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            request = httpx.Request("POST", "https://api.sarvam.ai/speech-to-text")
            raise httpx.ReadTimeout("provider timed out", request=request)

    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "server-only-test-key")
    monkeypatch.setattr(providers.httpx, "AsyncClient", FakeClient)

    async def run():
        return await providers.transcribe(
            b"private-audio", filename="private-audio.wav",
            content_type="audio/wav", language="unknown",
            context="private phrase",
        )

    with pytest.raises(providers.ProviderUnavailable, match="timed out"):
        asyncio.run(run())


def test_sarvam_rejects_more_than_fifty_keyterms_without_network(monkeypatch):
    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "server-only-test-key")
    terms = "\n".join(f"term-{index}" for index in range(51))

    with pytest.raises(ValueError, match="at most 50"):
        asyncio.run(
            providers.transcribe(
                b"audio", filename="clip.wav", content_type="audio/wav",
                language="unknown", context=terms,
            )
        )

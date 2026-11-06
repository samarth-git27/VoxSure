import logging

import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.providers import ProviderUnavailable


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VOXSURE_PROVIDER", "demo")
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    return TestClient(main.app)


def wav_payload() -> bytes:
    return b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 16


def test_health_and_provider_status(client):
    health = client.get("/api/health")
    providers = client.get("/api/providers")

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["provider"]["mode"] == "demo"
    assert providers.json()["provider"]["available"] is True
    assert {"code": "kn-IN", "name": "Kannada"} in providers.json()["supported_languages"]


def test_demo_sample_is_explicitly_a_fixture_and_contains_analysis(client):
    sample = client.get("/api/samples")

    assert sample.status_code == 200
    assert sample.json()["source"] == "sample_fixture"
    assert "no audio was processed" in sample.json()["label"]
    assert sample.json()["transcript"]
    assert sample.json()["analysis"][0]["kind"] == "date"
    assert sample.json()["confidence"] is None


def test_demo_upload_returns_fixture_and_never_uses_uploaded_audio(client, caplog):
    with caplog.at_level(logging.INFO, logger="voxsure.api"):
        response = client.post(
            "/api/transcriptions",
            files={"file": ("caller.wav", wav_payload(), "audio/wav")},
            data={"language": "unknown"},
        )

    assert response.status_code == 200
    assert response.json()["source"] == "demo_sample"
    assert "Demo sample" in response.json()["provider"]
    assert "no audio was processed" in response.json()["label"].lower()
    assert response.json()["filename"] == "caller.wav"
    assert response.json()["confidence"] is None
    assert response.json()["segments"] is None
    assert "caller.wav" not in caplog.text
    assert response.json()["transcript"] not in caplog.text


def test_unknown_provider_reports_not_configured(client, monkeypatch):
    monkeypatch.setenv("VOXSURE_PROVIDER", "unknown")

    assert client.get("/api/health").json()["provider"]["available"] is False
    assert client.post(
        "/api/transcriptions",
        files={"file": ("caller.wav", wav_payload(), "audio/wav")},
    ).status_code == 503


def test_sarvam_mode_without_key_returns_clear_not_configured(client, monkeypatch):
    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)

    response = client.post(
        "/api/transcriptions",
        files={"file": ("caller.wav", wav_payload(), "audio/wav")},
    )

    assert response.status_code == 503
    assert "SARVAM_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize(
    ("filename", "content_type", "content", "expected"),
    [
        ("caller.exe", "application/octet-stream", b"RIFF" + b"\x00" * 20, 415),
        ("caller.wav", "application/octet-stream", b"not an audio file!", 415),
        ("caller.wav", "text/plain", wav_payload(), 415),
    ],
)
def test_audio_validation_rejects_bad_extension_media_or_signature(
    client, filename, content_type, content, expected
):
    response = client.post(
        "/api/transcriptions", files={"file": (filename, content, content_type)}
    )

    assert response.status_code == expected


def test_oversized_file_is_rejected(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 20)
    response = client.post(
        "/api/transcriptions",
        files={"file": ("caller.wav", wav_payload() + b"x" * 30, "audio/wav")},
    )

    assert response.status_code == 413


def test_invalid_language_and_glossary_are_rejected(client, monkeypatch):
    invalid_language = client.post(
        "/api/transcriptions",
        files={"file": ("caller.wav", wav_payload(), "audio/wav")},
        data={"language": "unsupported"},
    )
    assert invalid_language.status_code == 422

    async def reject_glossary(*args, **kwargs):
        raise ValueError("Provide at most 50 glossary terms, each up to 64 characters.")

    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "not-a-real-test-credential")
    monkeypatch.setattr(main, "transcribe", reject_glossary)
    invalid_glossary = client.post(
        "/api/transcriptions",
        files={"file": ("caller.wav", wav_payload(), "audio/wav")},
        data={"context": "term"},
    )
    assert invalid_glossary.status_code == 422


def test_provider_failure_is_reported_without_exposing_provider_details(
    client, monkeypatch, caplog
):
    async def fail(*args, **kwargs):
        raise ProviderUnavailable("The speech provider timed out. Please try again.")

    monkeypatch.setenv("VOXSURE_PROVIDER", "sarvam")
    monkeypatch.setenv("SARVAM_API_KEY", "never-log-this-secret")
    monkeypatch.setattr(main, "transcribe", fail)

    with caplog.at_level(logging.WARNING):
        response = client.post(
            "/api/transcriptions",
            files={"file": ("caller.wav", wav_payload(), "audio/wav")},
        )

    assert response.status_code == 503
    assert "timed out" in response.json()["detail"]
    assert "never-log-this-secret" not in caplog.text
    assert "caller" not in caplog.text


def test_evaluate_endpoint_matches_metric_engine(client):
    response = client.post(
        "/api/evaluate",
        json={"reference": "the cat", "hypothesis": "a cat jumps"},
    )

    assert response.status_code == 200
    assert response.json()["word"]["wer"] == 1
    assert response.json()["word"]["substitutions"] == 1
    assert response.json()["word"]["insertions"] == 1
    assert "entities" not in response.json()


def test_evaluate_endpoint_validates_payload(client):
    response = client.post("/api/evaluate", json={"reference": "ok"})

    assert response.status_code == 422

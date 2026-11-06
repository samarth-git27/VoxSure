import argparse, importlib.metadata, json, os, platform, time
from datetime import datetime, timezone
from pathlib import Path
from math import gcd

import numpy as np
import torch
from datasets import load_dataset
from scipy.signal import resample_poly
from transformers import AutoModel

MODEL_ID = "ARTPARK-IISc/SraVaani-0.5-live"
DATASET_ID = "ConvoZenAI/indictelephony-bench"
LOOKAHEADS = (0, 80, 480, 1040)

def version(name):
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None

def to_mono_16k(audio, source_rate):
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        # Dataset should be mono; average channels defensively.
        audio = audio.mean(axis=-1) if audio.shape[-1] <= 8 else audio.mean(axis=0)
    if audio.ndim != 1:
        raise ValueError(f"Expected mono audio, got shape {audio.shape}")
    if source_rate <= 0:
        raise ValueError(f"Invalid sample rate: {source_rate}")
    if source_rate != 16000:
        d = gcd(source_rate, 16000)
        audio = resample_poly(audio, 16000 // d, source_rate // d).astype(np.float32)
    return np.ascontiguousarray(audio, dtype=np.float32)

def sync(device):
    if device.startswith("cuda") and torch.cuda.is_available():
        torch.cuda.synchronize()

def main():
    p = argparse.ArgumentParser(description="Capture SraVaani incremental hypotheses for one dataset utterance.")
    p.add_argument("--language", default="Kannada")
    p.add_argument("--index", type=int, default=0)
    p.add_argument("--lookahead-ms", type=int, choices=LOOKAHEADS, default=480)
    p.add_argument("--chunk-ms", type=int, default=200)
    p.add_argument("--max-seconds", type=float, default=30.0, help="Safety cap; 0 disables")
    p.add_argument("--output-dir", default="outputs")
    p.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    a = p.parse_args()
    if a.chunk_ms <= 0 or a.max_seconds < 0:
        p.error("--chunk-ms must be positive and --max-seconds nonnegative")

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("Warning: HF_TOKEN is unset; gated model access may fail.")
    print(f"Loading {DATASET_ID}, configuration={a.language}")
    ds = load_dataset(DATASET_ID, a.language, split="test")
    if not 0 <= a.index < len(ds):
        raise SystemExit(f"--index must be in [0, {len(ds)-1}]")
    row = ds[a.index]
    audio_obj = row["audio"]
    source_rate = int(audio_obj["sampling_rate"])
    audio = to_mono_16k(audio_obj["array"], source_rate)
    original_duration = len(audio) / 16000
    capped = False
    if a.max_seconds > 0 and original_duration > a.max_seconds:
        audio = audio[:int(a.max_seconds * 16000)]
        capped = True

    device = a.device
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda" and not torch.cuda.is_available():
        raise SystemExit("CUDA requested, but PyTorch cannot access CUDA.")

    print(f"Loading {MODEL_ID} on {device}. First load may download ~900 MB.")
    model = AutoModel.from_pretrained(
        MODEL_ID, trust_remote_code=True, token=token
    ).to(device).eval()
    for method in ("new_stream", "stream_audio", "finalize"):
        if not hasattr(model, method):
            raise RuntimeError(f"Loaded model lacks documented streaming method {method!r}; stop and inspect its model card.")

    if hasattr(model, "set_lookahead_ms"):
        model.set_lookahead_ms(a.lookahead_ms)
    else:
        if not hasattr(model, "set_att_context_size"):
            raise RuntimeError("Model exposes neither set_lookahead_ms nor set_att_context_size.")
        model.set_att_context_size([70, {0: 0, 80: 1, 480: 6, 1040: 13}[a.lookahead_ms]])

    stream = model.new_stream()
    chunk_samples = max(1, int(16000 * a.chunk_ms / 1000))
    outdir = Path(a.output_dir)
    outdir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    uid = str(row.get("utterance_id", f"{a.language}_{a.index:05d}"))
    safe_uid = "".join(c if c.isalnum() or c in "-_" else "_" for c in uid)
    run_id = f"{stamp}_{safe_uid}_la{a.lookahead_ms}_chunk{a.chunk_ms}"
    jsonl_path = outdir / f"{run_id}.jsonl"
    metadata_path = outdir / f"{run_id}.metadata.json"

    meta = {
        "run_id": run_id, "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_id": MODEL_ID, "dataset_id": DATASET_ID, "configuration": a.language,
        "split": "test", "row_index": a.index, "utterance_id": uid,
        "call_id": row.get("call_id"), "language": row.get("language"),
        "language_tag": row.get("language_tag"), "is_code_mixed": row.get("is_code_mixed"),
        "domain": row.get("domain"), "source_sample_rate_hz": source_rate,
        "model_input_sample_rate_hz": 16000, "original_duration_sec": original_duration,
        "processed_duration_sec": len(audio) / 16000, "duration_capped": capped,
        "reference_transcript": row.get("transcription"),
        "normalized_reference_transcript": row.get("transcription_normalized"),
        "keywords": row.get("keywords"), "lookahead_ms": a.lookahead_ms,
        "chunk_ms": a.chunk_ms, "device": device, "python_version": platform.python_version(),
        "package_versions": {n: version(n) for n in ("torch", "transformers", "datasets", "huggingface-hub", "scipy", "numpy", "soundfile")},
        "timing_note": "audio_end_ms is audio progress; elapsed_wall_ms and processing_ms are wall-clock. This is unpaced replay, not live arrival timing.",
        "jsonl_path": str(jsonl_path)
    }

    run_start = time.perf_counter()
    count = 0
    final_text = ""
    with jsonl_path.open("w", encoding="utf-8") as f:
        for chunk_idx, start in enumerate(range(0, len(audio), chunk_samples)):
            end = min(start + chunk_samples, len(audio))
            sync(device)
            t0 = time.perf_counter()
            with torch.inference_mode():
                text = model.stream_audio(stream, audio[start:end])
            sync(device)
            t1 = time.perf_counter()
            text = "" if text is None else str(text)
            record = {
                "record_type": "partial", "run_id": run_id, "utterance_id": uid,
                "chunk_index": chunk_idx, "audio_start_ms": start / 16,
                "audio_end_ms": end / 16, "elapsed_wall_ms": (t1-run_start)*1000,
                "processing_ms": (t1-t0)*1000, "hypothesis": text, "is_final": False
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
            if chunk_idx == 0 or (chunk_idx + 1) % 10 == 0:
                print(f"chunk={chunk_idx+1:04d} audio={end/16000:.2f}s "
                      f"processing={(t1-t0)*1000:.1f}ms text={text[:90]!r}")

        sync(device)
        t0 = time.perf_counter()
        with torch.inference_mode():
            final_text = model.finalize(stream)
        sync(device)
        t1 = time.perf_counter()
        final_text = "" if final_text is None else str(final_text)
        f.write(json.dumps({
            "record_type": "final", "run_id": run_id, "utterance_id": uid,
            "chunk_index": None, "audio_start_ms": None, "audio_end_ms": len(audio)/16,
            "elapsed_wall_ms": (t1-run_start)*1000, "processing_ms": (t1-t0)*1000,
            "hypothesis": final_text, "is_final": True
        }, ensure_ascii=False) + "\n")
        count += 1

    meta["records_written"] = count
    meta["final_transcript"] = final_text
    meta["total_wall_time_ms"] = (time.perf_counter() - run_start) * 1000
    metadata_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nCapture complete")
    print("Reference:", row.get("transcription", ""))
    print("Final:    ", final_text)
    print("JSONL:    ", jsonl_path)
    print("Metadata: ", metadata_path)

if __name__ == "__main__":
    main()

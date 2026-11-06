import argparse, json
from datasets import load_dataset

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--language", default="Kannada")
    p.add_argument("--index", type=int, default=0)
    a = p.parse_args()
    ds = load_dataset("ConvoZenAI/indictelephony-bench", a.language, split="test")
    if not 0 <= a.index < len(ds):
        raise SystemExit(f"Index must be in [0, {len(ds)-1}]")
    row = ds[a.index]
    audio = row["audio"]
    out = {
        "configuration": a.language, "split": "test", "row_index": a.index,
        "row_count": len(ds), "utterance_id": row.get("utterance_id"),
        "call_id": row.get("call_id"), "language": row.get("language"),
        "language_tag": row.get("language_tag"), "is_code_mixed": row.get("is_code_mixed"),
        "duration_sec": row.get("duration_sec"), "audio_sample_rate": audio.get("sampling_rate"),
        "audio_samples": len(audio.get("array", [])), "domain": row.get("domain"),
        "reference_transcript": row.get("transcription"),
        "normalized_reference": row.get("transcription_normalized"), "keywords": row.get("keywords")
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

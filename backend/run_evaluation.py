import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from .evaluation import evaluate


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reproduce WER/CER for a local, human-labelled JSON text pair."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("configs/evaluation.example.json"),
        help="JSON file containing a reference, hypothesis, and optional normalization.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("results"),
        help="Directory for JSON and CSV results (default: results/).",
    )
    args = parser.parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(payload.get("reference"), str) or not isinstance(
        payload.get("hypothesis"), str
    ):
        parser.error("input JSON must include string fields: reference and hypothesis")
    normalization = payload.get("normalization", {})
    if not isinstance(normalization, dict):
        parser.error("normalization must be a JSON object")
    result = evaluate(payload["reference"], payload["hypothesis"], **normalization)
    timestamp = datetime.now(timezone.utc).isoformat()
    report = {
        "name": payload.get("name", args.input.stem),
        "provenance": payload.get("provenance", "Locally supplied reference and hypothesis."),
        "created_at_utc": timestamp,
        "input_file": str(args.input),
        "result": result,
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "evaluation.json"
    csv_path = args.output_dir / "evaluation.csv"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        writer.writerow(["wer", result["word"]["wer"]])
        writer.writerow(["cer", result["character"]["cer"]])
        writer.writerow(["substitutions", result["word"]["substitutions"]])
        writer.writerow(["deletions", result["word"]["deletions"]])
        writer.writerow(["insertions", result["word"]["insertions"]])
        writer.writerow(["reference_words", result["word"]["reference_count"]])
        writer.writerow(["reference_codepoints", result["character"]["reference_count"]])
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")


if __name__ == "__main__":
    main()

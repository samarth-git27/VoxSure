import re


_PATTERNS = (
    ("amount", re.compile(r"(?<!\w)(?:₹|INR\s?|Rs\.?\s?)\s?\d[\d,]*(?:\.\d{1,2})?(?!\w)", re.I)),
    ("date", re.compile(r"(?<!\w)(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})(?!\w)")),
    ("time", re.compile(r"(?<!\w)(?:[01]?\d|2[0-3]):[0-5]\d(?:\s?[AP]M)?(?!\w)", re.I)),
    ("identifier", re.compile(r"(?<!\w)(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*(?!\w)", re.I)),
    ("number", re.compile(r"(?<![\w.:/-])\d[\d,]*(?:\.\d+)?(?![\w.:/-])")),
)


def inspect_transcript(transcript: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    occupied: list[tuple[int, int]] = []
    for kind, pattern in _PATTERNS:
        for match in pattern.finditer(transcript):
            if any(match.start() < end and start < match.end() for start, end in occupied):
                continue
            occupied.append((match.start(), match.end()))
            findings.append(
                {
                    "kind": kind,
                    "value": match.group(),
                    "basis": f"Matched the built-in {kind} pattern; verify against the audio.",
                    "status": "needs_review",
                }
            )
    return sorted(findings, key=lambda finding: transcript.find(finding["value"]))

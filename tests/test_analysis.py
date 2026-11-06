from backend.analysis import inspect_transcript


def test_number_review_is_deterministic_and_does_not_claim_error():
    first = inspect_transcript("Pay ₹1,200.50 on 14/08/2026 at 10:30 for ID KA-4821.")

    assert [(item["kind"], item["value"]) for item in first] == [
        ("amount", "₹1,200.50"),
        ("date", "14/08/2026"),
        ("time", "10:30"),
        ("identifier", "KA-4821"),
        ("number", "1,200.50"),
    ][:4]
    assert all(item["status"] == "needs_review" for item in first)
    assert all("verify against the audio" in item["basis"] for item in first)


def test_regular_numeric_value_is_found_and_text_is_not_changed():
    transcript = "Meeting at 2026/10/29 with 42 people."
    findings = inspect_transcript(transcript)

    assert [item["value"] for item in findings] == ["2026/10/29", "42"]
    assert transcript == "Meeting at 2026/10/29 with 42 people."


def test_empty_and_plain_language_text_produce_no_flags():
    assert inspect_transcript("") == []
    assert inspect_transcript("Namaskara, thank you very much.") == []

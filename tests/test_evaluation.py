import pytest

from backend.evaluation import evaluate, normalize_text


def test_wer_uses_substitution_deletion_and_insertion_counts():
    result = evaluate("a b c d e f", "a x c e f z")

    assert result["word"] == {
        "reference_count": 6,
        "substitutions": 1,
        "deletions": 1,
        "insertions": 1,
        "errors": 3,
        "wer": 0.5,
    }


def test_alignment_marks_substitutions_insertions_and_deletions():
    result = evaluate("a b c", "a x c d")

    assert [row["operation"] for row in result["alignment"]] == [
        "equal",
        "substitution",
        "equal",
        "insertion",
    ]
    assert result["alignment"][-1] == {
        "operation": "insertion",
        "reference": None,
        "hypothesis": "d",
    }


def test_unicode_cer_counts_codepoints_and_whitespace():
    result = evaluate("क ख", "क ग")

    assert result["character"]["reference_count"] == 3
    assert result["character"]["errors"] == 1
    assert result["character"]["cer"] == pytest.approx(1 / 3)


def test_default_preserves_case_punctuation_and_leading_zeroes():
    result = evaluate("Call 007.", "call 7")

    assert result["normalized_reference"] == "Call 007."
    assert result["normalized_hypothesis"] == "call 7"
    assert result["word"]["wer"] == 1


@pytest.mark.parametrize(
    ("text", "options", "expected"),
    [
        ("  Hello,\tWorld!  ", {}, "Hello, World!"),
        ("Hello, World!", {"lowercase": True}, "hello, world!"),
        ("Hello, World!", {"strip_punctuation": True}, "Hello World"),
        ("case   preserved", {"normalize_whitespace": False}, "case   preserved"),
        ("ID 0007", {"normalize_numbers": True}, "ID 7"),
    ],
)
def test_normalization_is_explicit(text, options, expected):
    assert normalize_text(text, **options) == expected


def test_empty_hypothesis_is_all_deletions():
    result = evaluate("one two", "")

    assert result["word"]["wer"] == 1
    assert result["word"]["deletions"] == 2
    assert result["word"]["substitutions"] == result["word"]["insertions"] == 0


def test_empty_reference_rate_is_undefined_but_counts_are_available():
    empty = evaluate("", "")
    inserted = evaluate("", "one two")

    assert empty["word"]["wer"] is None
    assert empty["character"]["cer"] is None
    assert empty["word"]["errors"] == 0
    assert inserted["word"]["wer"] is None
    assert inserted["word"]["insertions"] == 2
    assert inserted["character"]["insertions"] == len("one two")


def test_annotation_metrics_require_both_reference_and_hypothesis_lists():
    unannotated = evaluate("A 10", "B 11", reference_numbers=["10"])
    annotated = evaluate(
        "A 10", "B 11",
        reference_entities=["A", "B"],
        hypothesis_entities=["B"],
        reference_numbers=["10", "10"],
        hypothesis_numbers=["10", "11"],
    )

    assert "numbers" not in unannotated
    assert annotated["entities"]["exact_match"] == 0.5
    assert annotated["entities"]["precision"] == 1
    assert annotated["numbers"]["matches"] == 1
    assert annotated["numbers"]["exact_match"] == 0.5


def test_annotated_empty_reference_has_undefined_recall():
    result = evaluate(
        "", "", reference_entities=[], hypothesis_entities=["unsolicited"]
    )

    assert result["entities"]["exact_match"] is None
    assert result["entities"]["recall"] is None
    assert result["entities"]["precision"] == 0

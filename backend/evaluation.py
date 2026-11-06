import re
import unicodedata
from collections import Counter
from dataclasses import dataclass


@dataclass(frozen=True)
class Edit:
    operation: str
    reference: str | None
    hypothesis: str | None


def normalize_text(
    text: str,
    *,
    lowercase: bool = False,
    strip_punctuation: bool = False,
    normalize_whitespace: bool = True,
    normalize_numbers: bool = False,
) -> str:
    value = unicodedata.normalize("NFC", text)
    if normalize_numbers:
        value = re.sub(r"(?<!\w)0+(\d+)(?!\w)", r"\1", value)
    if lowercase:
        value = value.lower()
    if strip_punctuation:
        value = "".join(
            character
            for character in value
            if not unicodedata.category(character).startswith("P")
        )
    if normalize_whitespace:
        value = " ".join(value.split())
    return value


def align(reference: list[str], hypothesis: list[str]) -> list[Edit]:
    costs = [[0] * (len(hypothesis) + 1) for _ in range(len(reference) + 1)]
    for row in range(len(reference) + 1):
        costs[row][0] = row
    for column in range(len(hypothesis) + 1):
        costs[0][column] = column

    for row in range(1, len(reference) + 1):
        for column in range(1, len(hypothesis) + 1):
            costs[row][column] = min(
                costs[row - 1][column] + 1,
                costs[row][column - 1] + 1,
                costs[row - 1][column - 1]
                + (reference[row - 1] != hypothesis[column - 1]),
            )

    result: list[Edit] = []
    row, column = len(reference), len(hypothesis)
    while row or column:
        if (
            row
            and column
            and costs[row][column]
            == costs[row - 1][column - 1]
            + (reference[row - 1] != hypothesis[column - 1])
        ):
            operation = (
                "equal" if reference[row - 1] == hypothesis[column - 1] else "substitution"
            )
            result.append(Edit(operation, reference[row - 1], hypothesis[column - 1]))
            row -= 1
            column -= 1
        elif row and costs[row][column] == costs[row - 1][column] + 1:
            result.append(Edit("deletion", reference[row - 1], None))
            row -= 1
        else:
            result.append(Edit("insertion", None, hypothesis[column - 1]))
            column -= 1

    return list(reversed(result))


def _edit_distance(reference: list[str], hypothesis: list[str]) -> tuple[int, int, int]:
    edits = align(reference, hypothesis)
    return (
        sum(edit.operation == "substitution" for edit in edits),
        sum(edit.operation == "deletion" for edit in edits),
        sum(edit.operation == "insertion" for edit in edits),
    )


def _annotation_score(reference: list[str], hypothesis: list[str]) -> dict[str, int | float]:
    reference_counts = Counter(reference)
    hypothesis_counts = Counter(hypothesis)
    matches = sum((reference_counts & hypothesis_counts).values())
    reference_count = len(reference)
    hypothesis_count = len(hypothesis)
    return {
        "matches": matches,
        "reference_count": reference_count,
        "hypothesis_count": hypothesis_count,
        "exact_match": matches / reference_count if reference_count else None,
        "precision": matches / hypothesis_count if hypothesis_count else None,
        "recall": matches / reference_count if reference_count else None,
    }


def evaluate(
    reference: str,
    hypothesis: str,
    *,
    lowercase: bool = False,
    strip_punctuation: bool = False,
    normalize_whitespace: bool = True,
    normalize_numbers: bool = False,
    reference_entities: list[str] | None = None,
    hypothesis_entities: list[str] | None = None,
    reference_numbers: list[str] | None = None,
    hypothesis_numbers: list[str] | None = None,
) -> dict:
    options = {
        "lowercase": lowercase,
        "strip_punctuation": strip_punctuation,
        "normalize_whitespace": normalize_whitespace,
        "normalize_numbers": normalize_numbers,
    }
    normalized_reference = normalize_text(reference, **options)
    normalized_hypothesis = normalize_text(hypothesis, **options)
    reference_words = normalized_reference.split()
    hypothesis_words = normalized_hypothesis.split()
    word_substitutions, word_deletions, word_insertions = _edit_distance(
        reference_words, hypothesis_words
    )
    reference_characters = list(normalized_reference)
    hypothesis_characters = list(normalized_hypothesis)
    character_substitutions, character_deletions, character_insertions = _edit_distance(
        reference_characters, hypothesis_characters
    )

    result: dict = {
        "normalized_reference": normalized_reference,
        "normalized_hypothesis": normalized_hypothesis,
        "word": {
            "reference_count": len(reference_words),
            "substitutions": word_substitutions,
            "deletions": word_deletions,
            "insertions": word_insertions,
            "errors": word_substitutions + word_deletions + word_insertions,
            "wer": (
                (word_substitutions + word_deletions + word_insertions) / len(reference_words)
                if reference_words
                else None
            ),
        },
        "character": {
            "reference_count": len(reference_characters),
            "substitutions": character_substitutions,
            "deletions": character_deletions,
            "insertions": character_insertions,
            "errors": character_substitutions + character_deletions + character_insertions,
            "cer": (
                (character_substitutions + character_deletions + character_insertions)
                / len(reference_characters)
                if reference_characters
                else None
            ),
        },
        "alignment": [
            {
                "operation": edit.operation,
                "reference": edit.reference,
                "hypothesis": edit.hypothesis,
            }
            for edit in align(reference_words, hypothesis_words)
        ],
        "normalization": options,
    }
    if reference_entities is not None and hypothesis_entities is not None:
        result["entities"] = _annotation_score(reference_entities, hypothesis_entities)
    if reference_numbers is not None and hypothesis_numbers is not None:
        result["numbers"] = _annotation_score(reference_numbers, hypothesis_numbers)
    return result

# Contributing

- Keep live inference separate from demo fixtures. Demo mode must never suggest that uploaded audio was processed.
- Preserve the provider transcript. Put deterministic flags and user-approved edits in separate fields.
- Add unit tests for metric edge cases, input validation, and provider error handling.
- Do not add benchmark scores unless the dataset split, licensing, model/version, exact configuration, and reproducible evaluation are included.
- Do not commit credentials, audio, transcript datasets, `outputs/`, `results/`, or `.env` files.
- Run the Python tests and frontend test/type/lint/build checks described in `README.md`.
- The existing `capture_stream.py` and `inspect_dataset.py` are research scripts; check the current upstream dataset/model terms and gated access requirements before using them.

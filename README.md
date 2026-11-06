# VoxSure

**Voice intelligence. Built for accuracy.**

VoxSure is an independent speech-intelligence pilot for inspecting Indian-language and code-mixed speech recognition. It keeps provider output separate from deterministic review hints, user edits, and reference-based WER/CER calculations.

> **Honesty & provenance:** The demo is curated sample text, not audio inference. Demo-mode uploads are deliberately ignored. No VoxSure benchmark has been run or measured. VoxSure is not affiliated with or endorsed by Sarvam AI.

## What works

- Responsive product pages and a real audio-analysis workspace.
- Server-validated, bounded audio uploads; WAV, MP3, M4A/MP4, WebM, FLAC, OGG/Opus, AAC, AMR, AIFF and WMA are accepted up to 25 MB.
- A deterministic demo/sample path that works without provider credentials and clearly says it did not process audio.
- A real server-side Sarvam speech-to-text adapter using the documented REST `saaras:v4` endpoint, multipart audio, `api-subscription-key`, language selection and optional `keyterms`.
- Transparent date, time, amount, numeric-value and numeric-identifier patterns. Each is a review prompt, not an asserted transcription error or an automatic correction.
- Editable user-approved corrections kept separate from immutable model output; copy, text and structured JSON export.
- Browser-local **metadata-only** history and a deletion action. Transcript content stays in memory and is not saved to browser storage.
- WER, CER, substitution/deletion/insertion alignment, explicit normalization options and annotated entity/number comparison; JSON/CSV export.
- Tested FastAPI endpoints, metrics, deterministic fixture behaviour and frontend interactions.
- Retained research pilot scripts: `capture_stream.py`, `inspect_dataset.py` and the existing resampling test. Research model/dataset dependencies are separate from the product backend.

## Architecture

- **Frontend:** React, TypeScript (strict mode), Vite, React Router and a custom responsive CSS design system.
- **API:** FastAPI/Pydantic. `/api/health`, `/api/providers`, `/api/samples`, `/api/transcriptions` and `/api/evaluate`.
- **Provider boundary:** deterministic demo fixtures and the optional Sarvam adapter. API keys stay server-side.
- **Data:** No database. Uploads are read in bounded chunks into request memory and forwarded without VoxSure disk persistence. Browser local storage contains analysis metadata only.
- **Evaluation:** Dynamic-programming Levenshtein alignment. WER tokenizes on whitespace. CER compares Unicode code points in normalized text (including retained spaces; not grapheme clusters). Default normalization collapses whitespace only. Case, punctuation and leading-zero normalization are explicit opt-ins. An empty reference yields an undefined rate, not a fabricated zero.
- **Research status:** No VoxSure research result, public benchmark, or accuracy-improvement claim is published. `configs/evaluation.example.json` is an illustrative local pair, not benchmark data.

## Requirements

- Python 3.11+ (the included Windows pilot environment is Python 3.13).
- Node.js 20+ and npm.
- A Sarvam API key is optional and is never needed for the demo or local metric evaluation.

## Run locally

From the repository root in PowerShell:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
npm ci
```

Copy the local environment template so both the API and Vite proxy read the same settings:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

In the first terminal, start the API in demo mode:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

In a second terminal at the same project root, build and serve the frontend:

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

Open <http://localhost:4173>. The preview server proxies `/api` to FastAPI at `http://127.0.0.1:8000`; demo mode is credential-free. To verify the API separately, visit <http://localhost:8000/api/health> or <http://localhost:8000/docs>.

The existing pilot virtual environment can be reused instead of creating one: activate `.venv` and install `backend\requirements.txt`. Keep the research-heavy root `requirements.txt` separate unless you plan to run the gated-model data scripts.

## Enable genuine live inference

1. Review the [official Sarvam speech-to-text REST documentation](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe) and the provider’s current data/pricing terms.
2. Set `VOXSURE_PROVIDER=sarvam` and `SARVAM_API_KEY` **only in the API server’s private environment**. Use `saaras:v4`; its documented `keyterms` support accepts at most 50 terms, each up to 64 characters. VoxSure sends those as separate phrases, not as browser code or a public `VITE_` variable.
3. Restart the API. `/api/health` reports whether a server-side key is present without returning it. Submit a supported clip to send a genuine provider request.
4. If the key is absent, provider times out, or Sarvam rejects/limits the request, VoxSure reports the error and does not display a sample as a live result.

Sarvam’s returned `language_probability`, when supplied, represents language detection—not per-word recognition confidence. Its REST timestamps are phrase/chunk timestamps, not word alignment.

## Evaluation

Reproduce the included local demonstration pair:

```powershell
.\.venv\Scripts\Activate.ps1
python -m backend.run_evaluation
```

Results are written to `results\evaluation.json` and `results\evaluation.csv`. This run calculates actual edit metrics for the explicit example strings; it does **not** evaluate an ASR model or produce a VoxSure benchmark. Supply your own JSON file with `reference`, `hypothesis`, and optional `normalization` options:

```powershell
python -m backend.run_evaluation --input configs\my-pair.json --output-dir results\my-pair
```

WER = (substitutions + deletions + insertions) / number of reference words. CER uses Unicode code points after the same explicit normalization choices. Annotated entity/number scores are computed only when both reference and hypothesis lists are provided. Without reference annotations, these scores are omitted.

## Checks

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm test
npm run typecheck
npm run lint
npm run build
```

## Environment

Copy `.env.example` to `.env` for optional local environment overrides. Never commit `.env` or paste a provider credential into a browser setting.

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VOXSURE_PROVIDER` | API server | `demo` | `demo` or `sarvam` |
| `SARVAM_API_KEY` | API server only | unset | Private Sarvam subscription key |
| `VOXSURE_MAX_UPLOAD_MB` | API server | `25` | Maximum audio body size |
| `VOXSURE_ALLOWED_ORIGINS` | API server | localhost Vite origins | Comma-separated exact browser origins |
| `VITE_API_BASE_URL` | Frontend build | same-origin | Root API URL for a separately deployed frontend |
| `VITE_API_PROXY_TARGET` | Vite dev/preview server | `http://127.0.0.1:8000` | Local FastAPI proxy target |
| `VITE_REPOSITORY_URL` | Frontend build | unset | Optional public source-code link |

`VOXSURE_ALLOWED_ORIGINS` must contain the exact deployed frontend origin (scheme and hostname, no path). CORS is not authentication.

## Deploy publicly

The included setup uses **Vercel for the Vite static frontend** and **Render for the FastAPI service**. A public deployment has not been made or verified by this project.

1. Push the project to a Git provider you control. Create Vercel and Render services separately from their dashboards.
2. Create the Render service from the repository root using `render.yaml`. Set `VOXSURE_ALLOWED_ORIGINS` to the final, exact HTTPS Vercel origin. `SARVAM_API_KEY` is a private Render environment secret; keep `VOXSURE_PROVIDER=demo` until a key is ready. Check Render’s `/api/health` health check after deploy.
3. Import the same repository into Vercel. Use the root directory, `npm ci` for install, `npm run build` for build and `dist` as output directory. Set `VITE_API_BASE_URL` to the Render API root, e.g. `https://your-service.onrender.com` (**no `/api` suffix**); set `VITE_REPOSITORY_URL` if desired. Frontend variables apply at build time; redeploy after changing them.
4. When the Vercel deployment receives its final hostname, put that exact origin in Render’s `VOXSURE_ALLOWED_ORIGINS`, redeploy, and check `/api/health` plus the Vercel app’s `/workspace` demo flow.
5. To enable live inference, add `SARVAM_API_KEY` as a private Render secret and change `VOXSURE_PROVIDER` to `sarvam`. Never enter either key into Vercel.

### Public-launch limitations to address

- This pilot does **not** include authentication, rate limiting, abuse protection, a database, persistent transcripts, or multi-user history. Do not expose it as an unrestricted sensitive-audio service. Add deployment-level protections before accepting untrusted public traffic.
- Confirm each provider’s retention and regional processing terms before sending sensitive speech. Vercel/Render service logs and request buffering are outside VoxSure’s application storage.
- Configure and validate custom domains, CORS, provider credentials/quota, HTTPS and health checks in the hosting accounts. A deploy is not successful until the deployed app and backend health endpoint are actually verified.
- Local research capture needs separate HF access, dataset terms, model weights and optional `HF_TOKEN`; no gated data/model is bundled or fetched by product tests.
- No license has been selected for this research starter. Review upstream model/dataset licenses separately before publishing derivatives.

## Contributing & current scope

Do not silently edit or normalize provider transcripts, present a pattern match as an error, make unsupported per-word confidence claims, or label illustrative sample input a measured model result. Preserve exact reference/hypothesis text and record evaluation settings. Add tests for any new behavior.

The previous model/dataset pilot scripts are retained, but their research dependencies and gated-hub workflow are not part of the production web backend.

# VoxSure privacy and data handling

VoxSure has no application database or authentication.

- Audio upload size is capped by `VOXSURE_MAX_UPLOAD_MB` (default 25 MB). The API reads at most the cap plus one byte before rejecting an oversized file. Supported extensions, media types and basic format signatures are checked.
- VoxSure does not write uploaded audio or transcript results to persistent application storage. Audio is handled in request memory, forwarded to the configured provider in live mode, and released when the request completes. The ASGI framework/runtime and hosting platform may buffer request bodies; this application cannot make guarantees about infrastructure logging, crash dumps, or provider retention.
- The default `demo` provider ignores uploaded audio and returns a curated text fixture. Do not upload sensitive audio in demo mode.
- In `sarvam` mode, audio, filename, language choice and optional glossary terms are sent to the official Sarvam REST API. Review the provider’s current terms and retention policy before using it with sensitive audio.
- Browser local storage stores run metadata only: filename, timestamp, provider, language, status, source and run ID. Transcript text remains in browser memory until the tab/session ends. Browser storage is not encrypted, synced or backed up. Users can delete metadata from History.
- No credentials, full transcripts, or audio contents are intentionally written to VoxSure logs. Frontend error messages do not return exception traces.
- Public deployments should use HTTPS, exact CORS origins, service-level logging review, authentication and rate limiting before accepting untrusted traffic. CORS is not authentication.

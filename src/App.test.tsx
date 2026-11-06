import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sample = {
  id: "sample-appointment-001",
  created_at: "2026-10-29T00:00:00+00:00",
  filename: "sample-not-audio.wav",
  language_setting: "Auto / code-mixed",
  duration_seconds: null,
  provider: "Demo sample",
  model: "VoxSure sample fixture",
  status: "sample",
  source: "sample_fixture",
  label: "DEMO SAMPLE — curated text; no audio was processed",
  transcript: "Namaskara, my appointment is on 14/08/2026 at 10:30. Please bring reference ID KA-4821.",
  confidence: null,
  segments: null,
  provider_request_id: null,
  analysis: [
    { kind: "date", value: "14/08/2026", basis: "Matched the built-in date pattern; verify against the audio.", status: "needs_review" },
    { kind: "time", value: "10:30", basis: "Matched the built-in time pattern; verify against the audio.", status: "needs_review" },
    { kind: "identifier", value: "KA-4821", basis: "Matched the built-in identifier pattern; verify against the audio.", status: "needs_review" },
  ],
};

const samplePairResult = {
  normalized_reference: "the cat sat",
  normalized_hypothesis: "the bat sat",
  word: { reference_count: 3, substitutions: 1, deletions: 0, insertions: 0, errors: 1, wer: 1 / 3 },
  character: { reference_count: 11, substitutions: 1, deletions: 0, insertions: 0, errors: 1, cer: 1 / 11 },
  alignment: [
    { operation: "equal", reference: "the", hypothesis: "the" },
    { operation: "substitution", reference: "cat", hypothesis: "bat" },
    { operation: "equal", reference: "sat", hypothesis: "sat" },
  ],
  normalization: { lowercase: false, strip_punctuation: false, normalize_whitespace: true, normalize_numbers: false },
};

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

function installApi(providerMode: "demo" | "sarvam" = "demo") {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/providers")) {
      return Response.json({
        provider: {
          mode: providerMode,
          available: true,
          configured: true,
          provider: providerMode === "demo" ? "VoxSure demo" : "Sarvam AI",
          model: providerMode === "demo" ? "VoxSure sample fixture" : "saaras:v4",
          reason: null,
        },
        supported_languages: [{ code: "unknown", name: "Auto / code-mixed" }],
      });
    }
    if (url.endsWith("/api/samples")) return Response.json(sample);
    if (url.endsWith("/api/transcriptions")) {
      if (init?.method !== "POST") throw new Error("Expected a transcription POST.");
      return Response.json(
        { detail: "The speech provider timed out. Please try again." },
        { status: 503 },
      );
    }
    if (url.endsWith("/api/evaluate")) return Response.json(samplePairResult);
    throw new Error(`Unexpected API request: ${url}`);
  });
}

describe("VoxSure application", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:local-audio");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders the public product page with an honest unrun benchmark state", () => {
    installApi();
    renderApp();

    expect(screen.getByRole("heading", { name: /every word should hold up/i })).toBeInTheDocument();
    expect(screen.getByText(/benchmark not run yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open workspace/i })).toHaveAttribute("href", "/workspace");
  });

  it("navigates into the product workspace", async () => {
    const user = userEvent.setup();
    installApi();
    renderApp();

    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    expect(await screen.findByRole("heading", { name: "Start with the signal." })).toBeInTheDocument();
    expect(await screen.findAllByText("Demo mode")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /load sample/i })).toBeEnabled();
  });

  it("loads an explicitly labelled demo fixture without sending an audio request", async () => {
    const user = userEvent.setup();
    const fetch = installApi();
    renderApp();

    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    await user.click(await screen.findByRole("button", { name: /load sample/i }));

    expect(await screen.findByText(/curated text; no audio was processed/i)).toBeInTheDocument();
    expect(screen.getByText(/Namaskara, my appointment is on/)).toBeInTheDocument();
    expect(screen.getAllByText(/word-level confidence and alignment were not provided/i).length).toBe(1);
    expect(fetch.mock.calls.some(([input]) => String(input).endsWith("/api/transcriptions"))).toBe(false);
    const storedMetadata = localStorage.getItem("voxsure-history-v1") ?? "";
    expect(storedMetadata).not.toContain("transcript");
    expect(storedMetadata).not.toContain(sample.transcript);
  });

  it("supports review, user-authored corrections, and transcript exports", async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    installApi();
    renderApp();

    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    await user.click(await screen.findByRole("button", { name: /load sample/i }));
    await user.click(await screen.findByRole("button", { name: /copy original/i }));
    expect(clipboardWrite).toHaveBeenCalledWith(sample.transcript);

    await user.click(screen.getAllByRole("button", { name: /^reviewed$/i })[0]);
    expect(screen.getByText("Reviewed · Undo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add correction/i }));
    await user.type(screen.getByLabelText("Correction"), "This is my correction.");
    await user.click(screen.getByRole("button", { name: /keep correction/i }));
    expect(screen.getByText("This is my correction.")).toBeInTheDocument();
    expect(screen.getByText(/IMMUTABLE ORIGINAL/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /download \.txt/i }));
    expect(downloadClick).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-audio");
  });

  it("rejects unsupported uploads and shows the file-validation error", async () => {
    const user = userEvent.setup({ applyAccept: false });
    installApi();
    renderApp();
    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    await screen.findByText(/drop audio here/i);

    const file = new File(["not audio"], "notes.txt", { type: "text/plain" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input!, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(/file type is not supported/i);
  });

  it("shows a real provider error instead of sample or fake transcript text", async () => {
    const user = userEvent.setup();
    installApi("sarvam");
    renderApp();

    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    await screen.findByRole("heading", { name: "Start with the signal." });
    const bytes = new Uint8Array(24);
    bytes.set([82, 73, 70, 70], 0);
    bytes.set([87, 65, 86, 69], 8);
    const file = new File([bytes], "caller.wav", { type: "audio/wav" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    await user.upload(input!, file);
    expect(await screen.findByRole("button", { name: /analyze audio/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /analyze audio/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/provider timed out/i);
    expect(screen.queryByText(sample.transcript)).not.toBeInTheDocument();
    expect(screen.getByText(/no transcript to inspect yet/i)).toBeInTheDocument();
  });

  it("computes a displayed evaluation and exports via result buttons", async () => {
    const user = userEvent.setup();
    installApi();
    renderApp();
    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    await user.click(await screen.findByRole("link", { name: /evaluation lab/i }));
    await user.click(await screen.findByRole("button", { name: /use sample pair/i }));
    await user.click(screen.getByRole("button", { name: /calculate evaluation/i }));

    expect(await screen.findByRole("heading", { name: "Comparison results" })).toBeInTheDocument();
    expect(screen.getByText("33.33%")).toBeInTheDocument();
    expect(screen.getByText("substitution")).toBeInTheDocument();
  });

  it("opens the mobile navigation and reaches local history", async () => {
    const user = userEvent.setup();
    installApi();
    renderApp();
    await user.click(screen.getAllByRole("link", { name: /open workspace/i })[0]);
    const menuButton = document.querySelector(".mobile-menu");
    expect(menuButton).not.toBeNull();
    fireEvent.click(menuButton!);
    const nav = screen.getByRole("navigation", { name: "Workspace navigation" });
    await user.click(within(nav).getByRole("link", { name: "History" }));

    expect(await screen.findByRole("heading", { name: "A record of your runs." })).toBeInTheDocument();
    expect(screen.getByText("No runs in this browser yet")).toBeInTheDocument();
  });
});

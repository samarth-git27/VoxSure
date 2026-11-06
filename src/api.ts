import { z } from "zod";
import type { AnalysisResult, EvaluationResult } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const providerResponse = z.object({
  provider: z.object({
    mode: z.string(),
    available: z.boolean(),
    configured: z.boolean(),
    provider: z.string().optional(),
    model: z.string().optional(),
    reason: z.string().nullable().optional(),
  }),
  supported_languages: z.array(z.object({ code: z.string(), name: z.string() })).optional(),
});

export type ProviderInfo = z.infer<typeof providerResponse>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, init);
  } catch {
    throw new Error("Cannot reach the VoxSure API. Start the backend and try again.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String(body.detail)
        : `The request failed (HTTP ${response.status}).`;
    throw new Error(detail);
  }
  return body as T;
}

export async function getProviderInfo(): Promise<ProviderInfo> {
  return providerResponse.parse(await request<unknown>("/providers"));
}

export async function getSample(): Promise<AnalysisResult> {
  return request<AnalysisResult>("/samples");
}

export async function transcribeAudio(
  file: File,
  language: string,
  context: string,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  form.append("context", context);
  return request<AnalysisResult>("/transcriptions", { method: "POST", body: form });
}

export async function evaluateTranscripts(
  reference: string,
  hypothesis: string,
  normalization: {
    lowercase: boolean;
    strip_punctuation: boolean;
    normalize_whitespace: boolean;
    normalize_numbers: boolean;
  },
  referenceEntities: string[],
  hypothesisEntities: string[],
  referenceNumbers: string[],
  hypothesisNumbers: string[],
): Promise<EvaluationResult> {
  return request<EvaluationResult>("/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference,
      hypothesis,
      normalization,
      ...(referenceEntities.length && hypothesisEntities.length
        ? { reference_entities: referenceEntities, hypothesis_entities: hypothesisEntities }
        : {}),
      ...(referenceNumbers.length && hypothesisNumbers.length
        ? { reference_numbers: referenceNumbers, hypothesis_numbers: hypothesisNumbers }
        : {}),
    }),
  });
}

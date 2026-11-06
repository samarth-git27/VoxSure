export type Finding = {
  kind: string;
  value: string;
  basis: string;
  status: "needs_review" | "reviewed" | "dismissed";
};

export type TranscriptSegment = { text: string; start: number; end: number };

export type AnalysisResult = {
  id: string;
  created_at: string;
  filename: string;
  language_setting: string;
  duration_seconds: number | null;
  provider: string;
  model: string;
  status: string;
  source: "demo_sample" | "live_provider" | "sample_fixture";
  label: string | null;
  transcript: string;
  confidence: number | null;
  segments: TranscriptSegment[] | null;
  provider_request_id: string | null;
  analysis: Finding[];
};

export type EvaluationResult = {
  normalized_reference: string;
  normalized_hypothesis: string;
  word: {
    reference_count: number;
    substitutions: number;
    deletions: number;
    insertions: number;
    errors: number;
    wer: number | null;
  };
  character: {
    reference_count: number;
    substitutions: number;
    deletions: number;
    insertions: number;
    errors: number;
    cer: number | null;
  };
  alignment: { operation: string; reference: string | null; hypothesis: string | null }[];
  normalization: Record<string, boolean>;
  entities?: AnnotationScore;
  numbers?: AnnotationScore;
};

export type AnnotationScore = {
  matches: number;
  reference_count: number;
  hypothesis_count: number;
  exact_match: number | null;
  precision: number | null;
  recall: number | null;
};

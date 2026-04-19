export type SignalPriority = "Act now" | "Watch" | "Verify" | "Ignore";

export type CompetitorTrackingPriority = "High" | "Medium" | "Low" | "Unknown";

export type SignalScoreFactor =
  | "strategicRelevance"
  | "freshness"
  | "confidence"
  | "competitorPriority"
  | "customerImpact"
  | "actionability";

export type SignalScoreInput = {
  strategicRelevance?: number;
  freshness: number;
  confidence: number;
  competitorPriority: number | CompetitorTrackingPriority;
  customerImpact: number;
  actionability: number;
  evidenceCount?: number;
};

export type SignalScoreBreakdown = {
  factor: SignalScoreFactor;
  raw: number;
  normalized: number;
  weight: number;
  contribution: number;
};

export type SignalScoreResult = {
  impactScore: number;
  priority: SignalPriority;
  breakdown: SignalScoreBreakdown[];
};

export type SignalSourceKind =
  | "job_posting"
  | "person_profile"
  | "company_profile"
  | "page_snapshot"
  | "provider_response"
  | "manual";

export type SignalEvidenceInput = {
  source: string;
  detail: string;
  observedAt?: string;
  url?: string;
  kind?: SignalSourceKind;
};

export type SignalRuleId =
  | "hiring_spike"
  | "leadership_gtm_hire"
  | "product_engineering_focus"
  | "new_geography"
  | "people_movement";

export type SignalRuleMatch = {
  ruleId: SignalRuleId;
  title: string;
  summary: string;
  confidence: number;
  customerImpact: number;
  actionability: number;
  evidence: SignalEvidenceInput[];
  metadata?: Record<string, unknown>;
};

export type JobPostingSignalInput = {
  id?: string;
  title: string;
  companyName?: string;
  location?: string;
  department?: string;
  seniority?: string;
  postedAt?: string;
  url?: string;
};

export type PersonMovementSignalInput = {
  personId?: string;
  name: string;
  title?: string;
  currentCompany?: string;
  previousCompany?: string;
  startedAt?: string;
  observedAt?: string;
  source?: string;
  url?: string;
};

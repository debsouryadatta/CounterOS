export type ThreatType =
  | "Direct"
  | "Indirect"
  | "Substitute"
  | "Emerging"
  | "Enterprise";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type SuggestionDecision = ApprovalStatus | "verified" | "ignored" | "snoozed";

export type CompanyIntelligenceStatus =
  | "unresolved"
  | "resolving"
  | "resolved"
  | "enriching"
  | "enriched"
  | "no_match"
  | "failed";

export type Priority = "Act now" | "Watch" | "Verify" | "Ignore";

export type ActivityStatus = "Done" | "Running" | "Needs approval" | "Queued";

export type ProductProfile = {
  name: string;
  description: string;
  icp: string;
  category: string;
  geography: string;
  wedge: string;
};

export type SuggestedCompetitor = {
  id: string;
  name: string;
  domain: string;
  description: string;
  threatType: ThreatType;
  confidence: number;
  priority: "High" | "Medium" | "Low";
  evidence: string[];
  status: SuggestionDecision;
  intelligenceStatus: CompanyIntelligenceStatus;
  crustdataCompanyId?: string | null;
  crustdataMatchConfidence?: number | null;
  identifyError?: string | null;
  identifiedAt?: string | null;
};

export type CompetitorProfile = {
  id: string;
  name: string;
  domain: string;
  threatType: ThreatType;
  trackingPriority: "High" | "Medium" | "Low";
  positioning: string;
  headcount: string;
  hiring: string;
  funding: string;
  confidence: number;
  intelligenceStatus: CompanyIntelligenceStatus;
  crustdataCompanyId?: string | null;
  crustdataMatchConfidence?: number | null;
  crustdataProfile?: unknown;
  enrichmentError?: string | null;
  enrichedAt?: string | null;
};

export type Evidence = {
  source: string;
  detail: string;
  freshness: string;
  url?: string | null;
};

export type Signal = {
  id: string;
  competitor: string;
  title: string;
  summary: string;
  impactScore: number;
  priority: Priority;
  detectedAt: string;
  evidence: Evidence[];
  meaning: string;
  recommendedMove: string;
  counterMoves: {
    defensive: string;
    offensive: string;
    ignore: string;
  };
};

export type Artifact = {
  id: string;
  type: "Battlecard" | "Target accounts" | "Positioning memo";
  title: string;
  summary: string;
  bullets: string[];
};

export type TrackedPage = {
  id: string;
  competitorId: string | null;
  url: string;
  pageType: "homepage" | "pricing" | "changelog" | "blog" | "docs" | "careers" | "other";
  status: "active" | "paused" | "failed";
  lastSnapshotAt: string | null;
  lastError: string | null;
};

export type PageSnapshot = {
  id: string;
  trackedPageId: string;
  url: string;
  title: string | null;
  extractedText: string;
  textHash: string;
  diffSummary: string | null;
  fetchedAt: string;
};

export type AgentActivity = {
  id: string;
  label: string;
  source: string;
  status: ActivityStatus;
  evidence: string;
};

export type AgentStepKind = "thinking" | "fetching" | "performing" | "saving" | "responding";

export type AgentRunStep = {
  id: string;
  kind: AgentStepKind;
  label: string;
  detail: string;
  status: ActivityStatus;
};

export type ChatMessage = {
  id: string;
  role: "agent" | "user";
  text: string;
  steps?: AgentRunStep[];
};

export type AgentToolOutput = {
  ok: boolean;
  summary: string;
  code?: string;
  productProfile?: ProductProfile | null;
  suggestedCompetitors?: SuggestedCompetitor[];
  suggestionUpdates?: SuggestedCompetitor[];
  approvedCompetitors?: CompetitorProfile[];
  removedCompetitorIds?: string[];
  artifact?: Artifact | null;
  activities?: AgentActivity[];
  trackedPages?: TrackedPage[];
  snapshots?: PageSnapshot[];
  signals?: Signal[];
};

export type DashboardData = {
  workspace: {
    id: string;
    name: string;
  };
  productProfile: ProductProfile | null;
  suggestedCompetitors: SuggestedCompetitor[];
  approvedCompetitors: CompetitorProfile[];
  signals: Signal[];
  artifacts: Artifact[];
  trackedPages: TrackedPage[];
  agentActivities: AgentActivity[];
  messages: ChatMessage[];
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

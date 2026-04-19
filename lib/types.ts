export type ThreatType =
  | "Direct"
  | "Indirect"
  | "Substitute"
  | "Emerging"
  | "Enterprise";

export type ApprovalStatus = "pending" | "approved" | "rejected";

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
  status: ApprovalStatus;
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
};

export type Evidence = {
  source: string;
  detail: string;
  freshness: string;
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

export type AgentActivity = {
  id: string;
  label: string;
  source: string;
  status: ActivityStatus;
  evidence: string;
};

export type ChatMessage = {
  id: string;
  role: "agent" | "user";
  text: string;
};

export type DashboardData = {
  workspace: {
    id: string;
    name: string;
  };
  productProfile: ProductProfile;
  suggestedCompetitors: SuggestedCompetitor[];
  approvedCompetitors: CompetitorProfile[];
  signals: Signal[];
  artifacts: Artifact[];
  agentActivities: AgentActivity[];
  messages: ChatMessage[];
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

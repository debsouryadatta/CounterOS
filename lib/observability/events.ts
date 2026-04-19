import type { JobName } from "../jobs/payloads";
import type { JobRunStatus } from "../jobs/status";

export type ObservabilityEventLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityEventName =
  | "agent.step"
  | "api.call"
  | "api.cache"
  | "approval.decision"
  | "crustdata.credits_estimated"
  | "job.queued"
  | "job.started"
  | "job.completed"
  | "job.failed"
  | "job.retrying"
  | "job.skipped"
  | "signal.scored"
  | "token.usage";

export type ObservabilityEventBase = {
  name: ObservabilityEventName;
  level?: ObservabilityEventLevel;
  timestamp?: string;
  workspaceId?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type ApiCallEvent = ObservabilityEventBase & {
  name: "api.call";
  provider: "crustdata" | "openai" | "internal" | "web" | string;
  endpoint: string;
  statusCode?: number;
  durationMs?: number;
  cacheStatus?: "hit" | "miss" | "skip";
};

export type ApiCacheEvent = ObservabilityEventBase & {
  name: "api.cache";
  provider: string;
  cacheKey: string;
  cacheStatus: "hit" | "miss" | "write" | "expired";
};

export type JobLifecycleEvent = ObservabilityEventBase & {
  name:
    | "job.queued"
    | "job.started"
    | "job.completed"
    | "job.failed"
    | "job.retrying"
    | "job.skipped";
  jobId?: string;
  jobType: JobName;
  status?: JobRunStatus;
  idempotencyKey?: string;
  attempt?: number;
  maxAttempts?: number;
  durationMs?: number;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
};

export type TokenUsageEvent = ObservabilityEventBase & {
  name: "token.usage";
  provider: "openai" | string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
};

export type CrustdataCreditsEstimatedEvent = ObservabilityEventBase & {
  name: "crustdata.credits_estimated";
  endpoint: string;
  estimatedCredits: number;
  resultCount?: number;
};

export type SignalScoredEvent = ObservabilityEventBase & {
  name: "signal.scored";
  signalId?: string;
  competitorId?: string;
  impactScore: number;
  priority: "Act now" | "Watch" | "Verify" | "Ignore";
};

export type ApprovalDecisionEvent = ObservabilityEventBase & {
  name: "approval.decision";
  entityType: "suggested_competitor" | "artifact" | "recommendation" | string;
  entityId: string;
  decision: "approved" | "rejected" | "edited" | "verified" | "ignored" | string;
  reason?: string;
};

export type AgentStepEvent = ObservabilityEventBase & {
  name: "agent.step";
  step: string;
  status: "queued" | "running" | "completed" | "failed" | "needs_approval";
  evidence?: string;
};

export type ObservabilityEvent =
  | AgentStepEvent
  | ApiCallEvent
  | ApiCacheEvent
  | ApprovalDecisionEvent
  | CrustdataCreditsEstimatedEvent
  | JobLifecycleEvent
  | SignalScoredEvent
  | TokenUsageEvent;

export type NormalizedObservabilityEvent = ObservabilityEvent & {
  level: ObservabilityEventLevel;
  timestamp: string;
};

export function normalizeObservabilityEvent(
  event: ObservabilityEvent
): NormalizedObservabilityEvent {
  return {
    ...event,
    level: event.level ?? (event.name.endsWith(".failed") ? "error" : "info"),
    timestamp: event.timestamp ?? new Date().toISOString()
  };
}

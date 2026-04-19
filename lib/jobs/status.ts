import type { JobName } from "./payloads";

export type JobRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "skipped"
  | "cancelled";

export type JobRunError = {
  name?: string;
  message: string;
  stack?: string;
};

export type JobRunState = {
  jobId: string;
  jobType: JobName;
  status: JobRunStatus;
  idempotencyKey?: string;
  attempts: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  nextRunAt?: string;
  durationMs?: number;
  error?: JobRunError;
};

const TERMINAL_STATUSES = new Set<JobRunStatus>([
  "succeeded",
  "failed",
  "skipped",
  "cancelled"
]);

const ALLOWED_TRANSITIONS: Record<JobRunStatus, JobRunStatus[]> = {
  queued: ["running", "skipped", "cancelled"],
  running: ["succeeded", "failed", "retrying", "cancelled"],
  succeeded: [],
  failed: ["retrying"],
  retrying: ["queued", "running", "failed", "cancelled"],
  skipped: [],
  cancelled: []
};

function nowIso(): string {
  return new Date().toISOString();
}

function toJobRunError(error: unknown): JobRunError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error)
  };
}

export function isTerminalJobStatus(status: JobRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isActiveJobStatus(status: JobRunStatus): boolean {
  return status === "queued" || status === "running" || status === "retrying";
}

export function canTransitionJobStatus(from: JobRunStatus, to: JobRunStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function createQueuedJobRunState(input: {
  jobId: string;
  jobType: JobName;
  idempotencyKey?: string;
  maxAttempts?: number;
  queuedAt?: string;
}): JobRunState {
  return {
    jobId: input.jobId,
    jobType: input.jobType,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    queuedAt: input.queuedAt ?? nowIso()
  };
}

export function markJobRunning(state: JobRunState, startedAt = nowIso()): JobRunState {
  return {
    ...state,
    status: "running",
    attempts: state.attempts + 1,
    startedAt,
    finishedAt: undefined,
    error: undefined
  };
}

export function markJobSucceeded(state: JobRunState, finishedAt = nowIso()): JobRunState {
  return {
    ...state,
    status: "succeeded",
    finishedAt,
    durationMs: state.startedAt
      ? Math.max(0, new Date(finishedAt).getTime() - new Date(state.startedAt).getTime())
      : undefined,
    error: undefined
  };
}

export function markJobFailed(
  state: JobRunState,
  error: unknown,
  finishedAt = nowIso()
): JobRunState {
  return {
    ...state,
    status: "failed",
    finishedAt,
    durationMs: state.startedAt
      ? Math.max(0, new Date(finishedAt).getTime() - new Date(state.startedAt).getTime())
      : undefined,
    error: toJobRunError(error)
  };
}

export function markJobRetrying(
  state: JobRunState,
  error: unknown,
  nextRunAt: string
): JobRunState {
  return {
    ...state,
    status: "retrying",
    nextRunAt,
    error: toJobRunError(error)
  };
}

export function markJobSkipped(
  state: JobRunState,
  reason: string,
  finishedAt = nowIso()
): JobRunState {
  return {
    ...state,
    status: "skipped",
    finishedAt,
    error: {
      message: reason
    }
  };
}

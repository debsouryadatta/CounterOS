import { CrustdataError } from "@/lib/crustdata/client";
import {
  getTrackedPageByUrl,
  listCompetitors,
  listTrackedPages,
  listWorkspaces,
  recordAgentActivity
} from "@/lib/db/queries";
import { enqueueCounterOSJob } from "@/lib/jobs/queue";
import type { JobPayload } from "@/lib/jobs/payloads";
import { snapshotTrackedPage } from "@/lib/pages/snapshot";
import { generateHiringSignalsForWorkspace } from "@/lib/signals/hiring";
import type { CompetitorProfile, TrackedPage } from "@/lib/types";

const DEFAULT_PAGE_INTERVAL_HOURS = 24;
const DEFAULT_HIRING_LIMIT = 25;

export type CollectionRunReason = "startup" | "schedule" | "manual" | "queue";

export type CollectionSummary = {
  workspaces: number;
  jobsQueued: number;
  pagesChecked: number;
  pageSignalsCreated: number;
  pageFailures: number;
  competitorsChecked: number;
  hiringJobsChecked: number;
  hiringSignalsCreated: number;
  hiringDuplicatesSkipped: number;
  hiringFailures: number;
  hiringSkippedReason?: string;
};

export async function enqueueDuePageSnapshotJobs(input: {
  reason: CollectionRunReason;
  minAgeHours?: number;
}): Promise<CollectionSummary> {
  const summary = createEmptySummary();
  const minAgeHours = input.minAgeHours ?? getNumberEnv(
    "COUNTEROS_PAGE_SNAPSHOT_INTERVAL_HOURS",
    DEFAULT_PAGE_INTERVAL_HOURS
  );
  const dueBeforeMs = Date.now() - minAgeHours * 60 * 60 * 1000;
  const workspaces = listWorkspaces();
  const bucket = dateBucket();

  summary.workspaces = workspaces.length;

  for (const workspace of workspaces) {
    const pages = listTrackedPages(workspace.id).filter(
      (page) => page.status !== "paused" && isDue(page.lastSnapshotAt, dueBeforeMs)
    );

    if (pages.length === 0) {
      continue;
    }

    for (const page of pages) {
      await enqueueCounterOSJob(
        {
          jobType: "page.snapshot",
          workspaceId: workspace.id,
          competitorId: page.competitorId ?? undefined,
          url: page.url,
          pageType: page.pageType,
          fetchDepth: 0,
          respectRobots: true,
          metadata: {
            reason: input.reason
          }
        },
        {
          jobId: pageSnapshotJobId(page, bucket)
        }
      );
      summary.jobsQueued += 1;
    }

    recordAgentActivity({
      workspaceId: workspace.id,
      label: "Queued page snapshots",
      source: "Worker cron",
      status: "Queued",
      evidence: `Queued ${pages.length} due page snapshot job${pages.length === 1 ? "" : "s"}.`
    });
  }

  return summary;
}

export async function enqueueHiringMonitoringJobs(input: {
  reason: CollectionRunReason;
  limit?: number;
}): Promise<CollectionSummary> {
  const summary = createEmptySummary();
  const workspaces = listWorkspaces();
  const bucket = dateBucket();

  summary.workspaces = workspaces.length;

  if (!process.env.CRUSTDATA_API_KEY) {
    summary.hiringSkippedReason = "CRUSTDATA_API_KEY is not configured.";
    return summary;
  }

  for (const workspace of workspaces) {
    const competitors = listCompetitors(workspace.id);

    if (competitors.length === 0) {
      continue;
    }

    for (const competitor of competitors) {
      await enqueueCounterOSJob(
        {
          jobType: "jobs.monitoring",
          workspaceId: workspace.id,
          competitorId: competitor.id,
          companyName: competitor.name,
          companyDomain: competitor.domain,
          roleKeywords: [],
          locations: [],
          lookbackDays: 14,
          baselineWindowDays: 30,
          limit: input.limit ?? DEFAULT_HIRING_LIMIT,
          provider: "crustdata",
          metadata: {
            reason: input.reason
          }
        },
        {
          jobId: hiringMonitoringJobId(competitor, bucket)
        }
      );
      summary.jobsQueued += 1;
    }

    recordAgentActivity({
      workspaceId: workspace.id,
      label: "Queued hiring signal checks",
      source: "Worker cron",
      status: "Queued",
      evidence: `Queued ${competitors.length} competitor hiring check${competitors.length === 1 ? "" : "s"}.`
    });
  }

  return summary;
}

export async function runPageSnapshotCollection(input: {
  reason: CollectionRunReason;
  minAgeHours?: number;
}): Promise<CollectionSummary> {
  const summary = createEmptySummary();
  const minAgeHours = input.minAgeHours ?? getNumberEnv(
    "COUNTEROS_PAGE_SNAPSHOT_INTERVAL_HOURS",
    DEFAULT_PAGE_INTERVAL_HOURS
  );
  const dueBeforeMs = Date.now() - minAgeHours * 60 * 60 * 1000;
  const workspaces = listWorkspaces();

  summary.workspaces = workspaces.length;

  for (const workspace of workspaces) {
    const pages = listTrackedPages(workspace.id).filter(
      (page) => page.status !== "paused" && isDue(page.lastSnapshotAt, dueBeforeMs)
    );

    if (pages.length === 0) {
      continue;
    }

    let workspaceChecked = 0;
    let workspaceSignals = 0;
    let workspaceFailures = 0;

    for (const page of pages) {
      try {
        const result = await snapshotTrackedPage({
          workspaceId: workspace.id,
          trackedPageId: page.id
        });

        workspaceChecked += 1;
        summary.pagesChecked += 1;

        if (result.signal) {
          workspaceSignals += 1;
          summary.pageSignalsCreated += 1;
        }
      } catch {
        workspaceFailures += 1;
        summary.pageFailures += 1;
      }
    }

    recordAgentActivity({
      workspaceId: workspace.id,
      label: "Scheduled page snapshots",
      source: "Worker cron",
      status: "Done",
      evidence: `Checked ${workspaceChecked} page${workspaceChecked === 1 ? "" : "s"}; created ${workspaceSignals} signal${workspaceSignals === 1 ? "" : "s"}${workspaceFailures > 0 ? `; ${workspaceFailures} failed` : ""}.`
    });
  }

  return summary;
}

export async function runHiringSignalCollection(input: {
  reason: CollectionRunReason;
  limit?: number;
}): Promise<CollectionSummary> {
  const summary = createEmptySummary();
  const workspaces = listWorkspaces();

  summary.workspaces = workspaces.length;

  if (!process.env.CRUSTDATA_API_KEY) {
    summary.hiringSkippedReason = "CRUSTDATA_API_KEY is not configured.";
    return summary;
  }

  for (const workspace of workspaces) {
    const competitorCount = listCompetitors(workspace.id).length;

    if (competitorCount === 0) {
      continue;
    }

    try {
      const result = await generateHiringSignalsForWorkspace({
        workspaceId: workspace.id,
        limit: input.limit ?? DEFAULT_HIRING_LIMIT
      });

      summary.competitorsChecked += result.checkedCompetitors;
      summary.hiringJobsChecked += result.checkedJobs;
      summary.hiringSignalsCreated += result.signals.length;
      summary.hiringDuplicatesSkipped += result.skippedDuplicates;

      recordAgentActivity({
        workspaceId: workspace.id,
        label: "Scheduled hiring signal check",
        source: "Worker cron",
        status: "Done",
        evidence: `Checked ${result.checkedCompetitors} competitor${result.checkedCompetitors === 1 ? "" : "s"} and ${result.checkedJobs} job${result.checkedJobs === 1 ? "" : "s"}; created ${result.signals.length} signal${result.signals.length === 1 ? "" : "s"}${result.skippedDuplicates > 0 ? `; skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"}` : ""}.`
      });
    } catch (error) {
      summary.hiringFailures += 1;
      recordAgentActivity({
        workspaceId: workspace.id,
        label: "Scheduled hiring signal check",
        source: "Worker cron",
        status: "Needs approval",
        evidence:
          error instanceof CrustdataError
            ? `${error.message}${error.status ? ` Provider status: ${error.status}.` : ""}`
            : error instanceof Error
              ? error.message
              : "Unknown hiring signal error."
      });
    }
  }

  return summary;
}

export async function handleCounterOSJob(payload: JobPayload) {
  if (payload.jobType === "page.snapshot") {
    const trackedPage = getTrackedPageByUrl(payload.workspaceId, payload.url);

    if (!trackedPage) {
      return {
        handled: false,
        jobType: payload.jobType,
        reason: "tracked_page_not_found"
      };
    }

    const result = await snapshotTrackedPage({
        workspaceId: payload.workspaceId,
        trackedPageId: trackedPage.id
      });
      recordAgentActivity({
        workspaceId: payload.workspaceId,
        label: "Page snapshot processed",
        source: "Worker queue",
        status: "Done",
        evidence: `${payload.url} snapshot saved${result.signal ? "; signal created." : "."}`
      });

      return {
        handled: true,
      jobType: payload.jobType,
      snapshotId: result.snapshot.id,
      signalId: result.signal?.id ?? null
    };
  }

  if (payload.jobType === "jobs.monitoring") {
    const result = await generateHiringSignalsForWorkspace({
      workspaceId: payload.workspaceId,
      competitorId: payload.competitorId,
      limit: payload.limit ?? DEFAULT_HIRING_LIMIT
    });
    recordAgentActivity({
      workspaceId: payload.workspaceId,
      label: "Hiring signal check processed",
      source: "Worker queue",
      status: "Done",
      evidence: `Checked ${payload.companyName}; created ${result.signals.length} signal${result.signals.length === 1 ? "" : "s"} from ${result.checkedJobs} job${result.checkedJobs === 1 ? "" : "s"}${result.skippedDuplicates > 0 ? `; skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"}` : ""}.`
    });

    return {
      handled: true,
      jobType: payload.jobType,
      signalCount: result.signals.length,
      checkedJobs: result.checkedJobs,
      skippedDuplicates: result.skippedDuplicates
    };
  }

  return {
    handled: false,
    jobType: payload.jobType,
    reason: "handler_not_implemented"
  };
}

function createEmptySummary(): CollectionSummary {
  return {
    workspaces: 0,
    jobsQueued: 0,
    pagesChecked: 0,
    pageSignalsCreated: 0,
    pageFailures: 0,
    competitorsChecked: 0,
    hiringJobsChecked: 0,
    hiringSignalsCreated: 0,
    hiringDuplicatesSkipped: 0,
    hiringFailures: 0
  };
}

function pageSnapshotJobId(page: TrackedPage, bucket: string) {
  return ["page-snapshot", page.id, bucket].join("-");
}

function hiringMonitoringJobId(competitor: CompetitorProfile, bucket: string) {
  return ["jobs-monitoring", competitor.id, bucket].join("-");
}

function dateBucket(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function isDue(lastRunAt: string | null, dueBeforeMs: number) {
  if (!lastRunAt) {
    return true;
  }

  const lastRunMs = Date.parse(lastRunAt);

  return !Number.isFinite(lastRunMs) || lastRunMs <= dueBeforeMs;
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

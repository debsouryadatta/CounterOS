import { Worker } from "bullmq";
import { loadEnvConfig } from "@next/env";
import cron, { type ScheduledTask } from "node-cron";
import { getRedisConnection, COUNTEROS_QUEUE_NAME } from "@/lib/jobs/queue";
import { parseJobPayload, type JobPayload } from "@/lib/jobs/payloads";
import { observabilityLogger } from "@/lib/observability/logger";
import {
  enqueueDuePageSnapshotJobs,
  enqueueHiringMonitoringJobs,
  handleCounterOSJob,
  type CollectionSummary
} from "./scheduled-collection";

loadEnvConfig(process.cwd());

const DEFAULT_PAGE_SNAPSHOT_CRON = "0 9 * * *";
const DEFAULT_HIRING_SIGNALS_CRON = "15 9 */3 * *";

const tasks: ScheduledTask[] = [];
let queueWorker: Worker<JobPayload> | null = null;
let pageRun: Promise<CollectionSummary> | null = null;
let hiringRun: Promise<CollectionSummary> | null = null;

async function main() {
  const timezone = getTimezone();

  await assertRedisReady();

  log("starting worker", {
    timezone,
    queue: "enabled",
    cron: isEnabled("COUNTEROS_CRON_ENABLED", true) ? "enabled" : "disabled"
  });

  await startQueueWorker();
  startCronSchedules(timezone);

  if (isEnabled("COUNTEROS_RUN_ON_STARTUP", true)) {
    await runStartupCollections();
  }

  if (process.env.COUNTEROS_WORKER_RUN_ONCE === "true") {
    await shutdown();
  }
}

async function startQueueWorker() {
  queueWorker = new Worker<JobPayload>(
    COUNTEROS_QUEUE_NAME,
    async (job) => {
      const payload = parseJobPayload(job.data);

      observabilityLogger.emit({
        name: "job.started",
        workspaceId: payload.workspaceId,
        jobType: payload.jobType,
        jobId: job.id ?? job.name,
        attempt: job.attemptsMade + 1
      });

      const startedAt = Date.now();
      const result = await handleCounterOSJob(payload);

      observabilityLogger.emit({
        name: "job.completed",
        workspaceId: payload.workspaceId,
        jobType: payload.jobType,
        jobId: job.id ?? job.name,
        durationMs: Date.now() - startedAt
      });

      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: getNumberEnv("COUNTEROS_WORKER_CONCURRENCY", 2)
    }
  );

  queueWorker.on("failed", (job, error) => {
    const payload = job ? parseJobPayload(job.data) : null;

    observabilityLogger.emit({
      name: "job.failed",
      workspaceId: payload?.workspaceId ?? "unknown",
      jobType: payload?.jobType ?? "competitor.discovery",
      jobId: job?.id ?? "unknown",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  });

  queueWorker.on("error", (error) => {
    logError("queue worker error", error);
  });

  await queueWorker.waitUntilReady();
}

function startCronSchedules(timezone: string) {
  if (!isEnabled("COUNTEROS_CRON_ENABLED", true)) {
    return;
  }

  const pageCron = process.env.COUNTEROS_PAGE_SNAPSHOT_CRON ?? DEFAULT_PAGE_SNAPSHOT_CRON;
  const hiringCron =
    process.env.COUNTEROS_HIRING_SIGNALS_CRON ?? DEFAULT_HIRING_SIGNALS_CRON;

  tasks.push(
    cron.schedule(
      pageCron,
      () => {
        void runPageSnapshots("schedule");
      },
      { timezone }
    )
  );
  tasks.push(
    cron.schedule(
      hiringCron,
      () => {
        void runHiringSignals("schedule");
      },
      { timezone }
    )
  );

  log("scheduled automatic collection", {
    pageSnapshots: `${describeCron(pageCron)} (${timezone})`,
    hiringSignals: `${describeCron(hiringCron)} (${timezone})`
  });
}

async function runStartupCollections() {
  if (isEnabled("COUNTEROS_RUN_PAGES_ON_STARTUP", true)) {
    await runPageSnapshots("startup");
  }

  if (isEnabled("COUNTEROS_RUN_HIRING_ON_STARTUP", false)) {
    await runHiringSignals("startup");
  }
}

async function runPageSnapshots(reason: "startup" | "schedule") {
  if (pageRun) {
    log("page snapshot run already in progress; skipping overlap.");
    return pageRun;
  }

  pageRun = enqueueDuePageSnapshotJobs({ reason })
    .then((summary) => {
      log("page snapshot jobs queued", summary);
      return summary;
    })
    .catch((error) => {
      logError("page snapshot run failed", error);
      throw error;
    })
    .finally(() => {
      pageRun = null;
    });

  return pageRun;
}

async function runHiringSignals(reason: "startup" | "schedule") {
  if (hiringRun) {
    log("hiring signal run already in progress; skipping overlap.");
    return hiringRun;
  }

  hiringRun = enqueueHiringMonitoringJobs({ reason })
    .then((summary) => {
      log("hiring signal jobs queued", summary);
      return summary;
    })
    .catch((error) => {
      logError("hiring signal run failed", error);
      throw error;
    })
    .finally(() => {
      hiringRun = null;
    });

  return hiringRun;
}

async function shutdown() {
  log("shutting down worker");

  for (const task of tasks) {
    task.stop();
  }

  await queueWorker?.close();
  await getRedisConnection().quit();

  process.exit(0);
}

async function assertRedisReady() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required. Start Redis with `docker compose up -d redis`.");
  }

  const redis = getRedisConnection();

  if (redis.status === "wait") {
    await redis.connect();
  }

  await Promise.race([
    redis.ping(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Timed out connecting to Redis. Is Docker Redis running?")),
        5_000
      );
    })
  ]);
}

function getTimezone() {
  return (
    process.env.COUNTEROS_WORKER_TIMEZONE ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC"
  );
}

function isEnabled(name: string, fallback: boolean) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function describeCron(expression: string) {
  if (expression === DEFAULT_PAGE_SNAPSHOT_CRON) {
    return "daily at 9:00 AM";
  }

  if (expression === DEFAULT_HIRING_SIGNALS_CRON) {
    return "every three days at 9:15 AM";
  }

  return expression;
}

function log(message: string, data?: unknown) {
  if (data === undefined) {
    console.log(`[counteros-worker] ${message}`);
    return;
  }

  console.log(`[counteros-worker] ${message}`, data);
}

function logError(message: string, error: unknown) {
  console.error(
    `[counteros-worker] ${message}`,
    error instanceof Error ? error.message : error
  );
}

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});

void main().catch((error) => {
  logError("worker crashed", error);
  process.exit(1);
});

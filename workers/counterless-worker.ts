import { Worker } from "bullmq";
import { getRedisConnection, COUNTERLESS_QUEUE_NAME } from "@/lib/jobs/queue";
import { parseJobPayload, type JobPayload } from "@/lib/jobs/payloads";
import { observabilityLogger } from "@/lib/observability/logger";

const worker = new Worker<JobPayload>(
  COUNTERLESS_QUEUE_NAME,
  async (job) => {
    const payload = parseJobPayload(job.data);

    observabilityLogger.emit({
      name: "job.started",
      workspaceId: payload.workspaceId,
      jobType: payload.jobType,
      jobId: job.id ?? job.name,
      attempt: job.attemptsMade + 1
    });

    // Product routes own synchronous MVP behavior for now. The worker is ready for
    // durable scheduled runs without moving provider calls into serverless paths.
    observabilityLogger.emit({
      name: "job.completed",
      workspaceId: payload.workspaceId,
      jobType: payload.jobType,
      jobId: job.id ?? job.name,
      durationMs: 0
    });

    return {
      handled: true,
      jobType: payload.jobType
    };
  },
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.COUNTERLESS_WORKER_CONCURRENCY ?? 2)
  }
);

worker.on("failed", (job, error) => {
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

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function shutdown() {
  await worker.close();
  await getRedisConnection().quit();
  process.exit(0);
}

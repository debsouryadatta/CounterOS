import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { createJobIdempotencyKey } from "./idempotency";
import { type JobPayload, parseJobPayload } from "./payloads";

export const COUNTEROS_QUEUE_NAME = "counteros-work";

let redisConnection: IORedis | null = null;
let queue: Queue<JobPayload> | null = null;

export function getRedisConnection() {
  if (redisConnection) {
    return redisConnection;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required for background jobs.");
  }

  redisConnection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  return redisConnection;
}

export function getCounterOSQueue() {
  if (queue) {
    return queue;
  }

  queue = new Queue<JobPayload>(COUNTEROS_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000
      },
      removeOnComplete: 500,
      removeOnFail: 1000
    }
  });

  return queue;
}

export async function enqueueCounterOSJob(
  payload: JobPayload,
  options: JobsOptions = {}
) {
  const parsed = parseJobPayload(payload);

  return getCounterOSQueue().add(parsed.jobType, parsed, {
    jobId: createJobIdempotencyKey(parsed.jobType, parsed),
    ...options
  });
}

import { createHash } from "node:crypto";

import type { JobName, JobPayload } from "./payloads";

const DEFAULT_EXCLUDED_KEYS = new Set([
  "attempt",
  "attempts",
  "enqueuedAt",
  "lastRunAt",
  "metadata",
  "nextRunAt",
  "requestId",
  "scheduledAt",
  "timestamp",
  "traceId"
]);

export type ResourceIdentity = {
  workspaceId?: string;
  resourceType: string;
  id?: string;
  provider?: string;
  domain?: string;
  url?: string;
  name?: string;
};

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizePrimitive(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

export function canonicalizeForIdempotency(
  value: unknown,
  excludedKeys: Set<string> = DEFAULT_EXCLUDED_KEYS
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForIdempotency(item, excludedKeys));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .filter(([key]) => !excludedKeys.has(key))
      .map(([key, nestedValue]) => {
        const normalizedValue =
          key.toLowerCase().includes("domain") && typeof nestedValue === "string"
            ? normalizeDomain(nestedValue)
            : key.toLowerCase().includes("url") && typeof nestedValue === "string"
              ? normalizeUrl(nestedValue)
              : canonicalizeForIdempotency(nestedValue, excludedKeys);

        return [key, normalizedValue] as const;
      })
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    return Object.fromEntries(entries);
  }

  return normalizePrimitive(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeForIdempotency(value));
}

export function hashIdempotencyParts(parts: unknown[], prefix = "idem"): string {
  const body = JSON.stringify(parts.map((part) => canonicalizeForIdempotency(part)));
  const digest = createHash("sha256").update(body).digest("hex").slice(0, 32);
  return `${prefix}:${digest}`;
}

export function createJobIdempotencyKey(
  jobType: JobName,
  payload: JobPayload | Record<string, unknown>
): string {
  return hashIdempotencyParts([jobType, payload], "job");
}

export function createResourceIdempotencyKey(identity: ResourceIdentity): string {
  return hashIdempotencyParts(
    [
      identity.workspaceId,
      identity.resourceType,
      identity.provider,
      identity.id,
      identity.domain ? normalizeDomain(identity.domain) : undefined,
      identity.url ? normalizeUrl(identity.url) : undefined,
      identity.name?.trim().toLowerCase()
    ],
    "resource"
  );
}

export function createJobResourceIdempotencyKey(
  jobType: JobName,
  identity: ResourceIdentity
): string {
  return hashIdempotencyParts([jobType, createResourceIdempotencyKey(identity)], "job-resource");
}

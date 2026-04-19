import { createHash, randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { apiCacheEntries } from "./schema";

export type ApiCacheKeyInput = {
  method: string;
  endpoint: string;
  apiVersion?: string;
  query?: unknown;
  body?: unknown;
};

export type ApiCacheLookupInput = {
  provider: string;
  cacheKey: string;
};

export type ApiCacheWriteInput = ApiCacheLookupInput & {
  endpoint: string;
  response: unknown;
  workspaceId?: string | null;
  ttlMs?: number | null;
};

export function createApiRequestCacheKey(input: ApiCacheKeyInput) {
  const method = input.method.trim().toUpperCase();
  const endpoint = normalizeEndpoint(input.endpoint);
  const version = input.apiVersion?.trim() || "default";
  const queryHash = hashStableValue(input.query ?? null);
  const bodyHash = hashStableValue(input.body ?? null);

  return [
    method,
    endpoint,
    `version:${version}`,
    `query:${queryHash}`,
    `body:${bodyHash}`
  ].join(":");
}

export function getCachedApiResponse<T>(input: ApiCacheLookupInput): T | null {
  const entry = db
    .select()
    .from(apiCacheEntries)
    .where(
      and(
        eq(apiCacheEntries.provider, input.provider),
        eq(apiCacheEntries.cacheKey, input.cacheKey)
      )
    )
    .limit(1)
    .get();

  if (!entry || isExpired(entry.expiresAt)) {
    return null;
  }

  try {
    return JSON.parse(entry.responseJson) as T;
  } catch {
    return null;
  }
}

export function cacheApiResponse(input: ApiCacheWriteInput) {
  const now = new Date().toISOString();
  const responseJson = JSON.stringify(input.response);
  const expiresAt =
    typeof input.ttlMs === "number" && input.ttlMs > 0
      ? new Date(Date.now() + input.ttlMs).toISOString()
      : null;

  db.insert(apiCacheEntries)
    .values({
      id: randomUUID(),
      workspaceId: input.workspaceId ?? null,
      provider: input.provider,
      endpoint: normalizeEndpoint(input.endpoint),
      cacheKey: input.cacheKey,
      responseJson,
      expiresAt,
      createdAt: now
    })
    .onConflictDoUpdate({
      target: [apiCacheEntries.provider, apiCacheEntries.cacheKey],
      set: {
        workspaceId: input.workspaceId ?? null,
        endpoint: normalizeEndpoint(input.endpoint),
        responseJson,
        expiresAt,
        createdAt: now
      }
    })
    .run();
}

export function hashStableValue(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value: unknown) {
  return JSON.stringify(toStableJsonValue(value));
}

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiresTime = Date.parse(expiresAt);
  return Number.isFinite(expiresTime) && expiresTime <= Date.now();
}

function toStableJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URLSearchParams) {
    return Array.from(value.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyCompare = leftKey.localeCompare(rightKey);
      return keyCompare === 0 ? leftValue.localeCompare(rightValue) : keyCompare;
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : toStableJsonValue(item)));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([entryKey, entryValue]) => [entryKey, toStableJsonValue(entryValue)])
    );
  }

  return null;
}

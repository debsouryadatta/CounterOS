import {
  cacheApiResponse,
  createApiRequestCacheKey,
  getCachedApiResponse
} from "@/lib/db/api-cache";
import type { CrustdataQuery, CrustdataRequestOptions } from "./types";

export const CRUSTDATA_API_VERSION = "2025-11-01";
export const CRUSTDATA_BASE_URL = "https://api.crustdata.com";
export const CRUSTDATA_CACHE_PROVIDER = "crustdata";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRYABLE_STATUSES = new Set([429]);

type CrustdataRequestInput<TBody> = CrustdataRequestOptions & {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: CrustdataQuery;
  body?: TBody;
};

type CrustdataErrorInput = {
  endpoint: string;
  method: string;
  status?: number;
  retryable?: boolean;
  responseBody?: string;
};

export class CrustdataError extends Error {
  endpoint: string;
  method: string;
  status: number | undefined;
  retryable: boolean;
  responseBody: string | undefined;

  constructor(message: string, input: CrustdataErrorInput) {
    super(message);
    this.name = "CrustdataError";
    this.endpoint = input.endpoint;
    this.method = input.method;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
    this.responseBody = input.responseBody;
  }
}

export async function requestCrustdata<TResponse, TBody = unknown>(
  input: CrustdataRequestInput<TBody>
): Promise<TResponse> {
  const method = input.method ?? "POST";
  const endpoint = normalizeEndpoint(input.endpoint);
  const cacheOptions = normalizeCacheOptions(input.cache);
  const cacheKey =
    cacheOptions.enabled &&
    (cacheOptions.cacheKey ??
      createApiRequestCacheKey({
        method,
        endpoint,
        apiVersion: CRUSTDATA_API_VERSION,
        query: input.query,
        body: input.body
      }));

  if (cacheOptions.enabled && cacheKey) {
    const cached = getCachedApiResponse<TResponse>({
      provider: CRUSTDATA_CACHE_PROVIDER,
      cacheKey
    });

    if (cached !== null) {
      return cached;
    }
  }

  const data = await requestCrustdataFromNetwork<TResponse, TBody>({
    ...input,
    endpoint,
    method
  });

  if (cacheOptions.enabled && cacheKey) {
    cacheApiResponse({
      provider: CRUSTDATA_CACHE_PROVIDER,
      endpoint,
      cacheKey,
      response: data,
      workspaceId: cacheOptions.workspaceId,
      ttlMs: cacheOptions.ttlMs
    });
  }

  return data;
}

async function requestCrustdataFromNetwork<TResponse, TBody>(
  input: CrustdataRequestInput<TBody> & {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  }
): Promise<TResponse> {
  const apiKey = process.env.CRUSTDATA_API_KEY;

  if (!apiKey) {
    throw new CrustdataError("CRUSTDATA_API_KEY is not configured.", {
      endpoint: input.endpoint,
      method: input.method
    });
  }

  const url = buildUrl(input.endpoint, input.query, input.baseUrl);
  const body = input.body === undefined ? undefined : JSON.stringify(input.body);
  const maxRetries = input.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetchWithTimeout(url, {
      method: input.method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "x-api-version": CRUSTDATA_API_VERSION
      },
      body,
      cache: "no-store",
      signal: input.signal,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    });

    if (response.ok) {
      return parseJsonResponse<TResponse>(response, input.endpoint, input.method);
    }

    if (isRetryableStatus(response.status) && attempt < maxRetries) {
      await sleep(getRetryDelayMs(attempt, response.headers.get("retry-after")));
      continue;
    }

    const responseBody = await readBodySnippet(response);

    throw new CrustdataError(
      `Crustdata request failed with status ${response.status}.`,
      {
        endpoint: input.endpoint,
        method: input.method,
        status: response.status,
        retryable: isRetryableStatus(response.status),
        responseBody
      }
    );
  }

  throw new CrustdataError("Crustdata request failed.", {
    endpoint: input.endpoint,
    method: input.method
  });
}

async function fetchWithTimeout(
  url: URL,
  input: RequestInit & {
    timeoutMs: number;
    signal?: AbortSignal;
  }
) {
  const { timeoutMs, signal, ...requestInit } = input;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();

  try {
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", abortFromParent, { once: true });
      }
    }

    return await fetch(url, {
      ...requestInit,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new CrustdataError("Crustdata request timed out or was aborted.", {
        endpoint: url.pathname,
        method: requestInit.method?.toString() ?? "POST"
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

async function parseJsonResponse<TResponse>(
  response: Response,
  endpoint: string,
  method: string
): Promise<TResponse> {
  if (response.status === 204) {
    return null as TResponse;
  }

  const text = await response.text();

  if (!text) {
    return null as TResponse;
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    throw new CrustdataError("Crustdata returned a non-JSON response.", {
      endpoint,
      method,
      status: response.status
    });
  }
}

function normalizeCacheOptions(cache: CrustdataRequestOptions["cache"]) {
  if (cache === false) {
    return {
      enabled: false,
      ttlMs: DEFAULT_CACHE_TTL_MS,
      workspaceId: null,
      cacheKey: undefined
    };
  }

  if (cache && typeof cache === "object") {
    return {
      enabled: true,
      ttlMs: cache.ttlMs ?? DEFAULT_CACHE_TTL_MS,
      workspaceId: cache.workspaceId ?? null,
      cacheKey: cache.cacheKey
    };
  }

  return {
    enabled: true,
    ttlMs: DEFAULT_CACHE_TTL_MS,
    workspaceId: null,
    cacheKey: undefined
  };
}

function buildUrl(endpoint: string, query: CrustdataQuery | undefined, baseUrl: string | undefined) {
  const url = new URL(
    normalizeEndpoint(endpoint),
    baseUrl ?? process.env.CRUSTDATA_BASE_URL ?? CRUSTDATA_BASE_URL
  );

  if (!query) {
    return url;
  }

  if (query instanceof URLSearchParams) {
    for (const [key, value] of query.entries()) {
      url.searchParams.append(key, value);
    }

    return url;
  }

  for (const [key, value] of Object.entries(query).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  )) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const arrayValue of value) {
        url.searchParams.append(key, String(arrayValue));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUSES.has(status) || (status >= 500 && status <= 599);
}

function getRetryDelayMs(attempt: number, retryAfter: string | null) {
  const retryAfterDelay = parseRetryAfterMs(retryAfter);

  if (retryAfterDelay !== null) {
    return Math.min(retryAfterDelay, 5_000);
  }

  const baseDelay = 500 * 2 ** attempt;
  return Math.min(baseDelay + Math.floor(Math.random() * 150), 5_000);
}

function parseRetryAfterMs(retryAfter: string | null) {
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds)) {
    return Math.max(seconds * 1000, 0);
  }

  const retryAt = Date.parse(retryAfter);

  if (!Number.isFinite(retryAt)) {
    return null;
  }

  return Math.max(retryAt - Date.now(), 0);
}

async function readBodySnippet(response: Response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 1000);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import "server-only";

import type {
  CompanySearchResponse,
  CrustdataCompanyData,
  CrustdataCompanyMatchEnvelope,
  GenericSearchResponse
} from "./types";

export function normalizeResultsArray<T>(payload: unknown, extraArrayKeys: string[] = []): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!isRecord(payload)) {
    return [];
  }

  const keys = ["results", ...extraArrayKeys];

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

export function normalizeCompanySearchResponse<TCompany = CrustdataCompanyData>(
  payload: unknown
): CompanySearchResponse<TCompany> {
  const companies = normalizeResultsArray<TCompany>(payload, ["companies"]);
  const envelope = isRecord(payload) ? payload : {};

  return {
    companies,
    next_cursor: readOptionalString(envelope.next_cursor ?? envelope.nextCursor),
    total_count: readOptionalNumber(envelope.total_count ?? envelope.totalCount),
    raw: payload
  };
}

export function normalizeResultsEnvelope<TItem>(
  payload: unknown,
  extraArrayKeys: string[] = []
): GenericSearchResponse<TItem> {
  const results = normalizeResultsArray<TItem>(payload, extraArrayKeys);
  const envelope = isRecord(payload) ? payload : {};

  return {
    results,
    next_cursor: readOptionalString(envelope.next_cursor ?? envelope.nextCursor),
    total_count: readOptionalNumber(envelope.total_count ?? envelope.totalCount),
    raw: payload
  };
}

export function normalizeCompanyMatchEnvelopes(
  payload: unknown
): CrustdataCompanyMatchEnvelope[] {
  const resultRows = normalizeResultsArray<unknown>(payload);
  const candidates =
    resultRows.length > 0
      ? resultRows
      : isRecord(payload) && Array.isArray(payload.matches)
        ? [payload]
        : [];

  return candidates
    .filter(isRecord)
    .map((candidate) => ({
      ...candidate,
      matched_on: readOptionalString(candidate.matched_on ?? candidate.matchedOn) ?? undefined,
      match_type: readOptionalString(candidate.match_type ?? candidate.matchType) ?? undefined,
      matches: Array.isArray(candidate.matches) ? candidate.matches : []
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

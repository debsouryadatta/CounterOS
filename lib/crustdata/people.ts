import "server-only";

import { requestCrustdata } from "./client";
import { normalizeResultsEnvelope } from "./normalizers";
import type {
  CrustdataPersonData,
  CrustdataRequestOptions,
  GenericSearchRequest,
  GenericSearchResponse,
  PersonEnrichRequest
} from "./types";

export async function searchPeople<TPerson = CrustdataPersonData>(
  input: GenericSearchRequest,
  options?: CrustdataRequestOptions
): Promise<GenericSearchResponse<TPerson>> {
  assertExplicitFields(input.fields, "searchPeople");

  const response = await requestCrustdata<unknown, GenericSearchRequest>({
    endpoint: "/person/search",
    method: "POST",
    body: input,
    ...options
  });

  return normalizeResultsEnvelope<TPerson>(response);
}

export async function enrichPerson<TPerson = CrustdataPersonData>(
  input: PersonEnrichRequest,
  options?: CrustdataRequestOptions
): Promise<GenericSearchResponse<TPerson>> {
  assertExplicitFields(input.fields, "enrichPerson");

  const response = await requestCrustdata<unknown, PersonEnrichRequest>({
    endpoint: "/person/enrich",
    method: "POST",
    body: input,
    ...options
  });

  return normalizeResultsEnvelope<TPerson>(response);
}

function assertExplicitFields(fields: readonly string[] | undefined, operation: string) {
  if (!fields || fields.length === 0 || fields.some((field) => field.trim().length === 0)) {
    throw new Error(`${operation} requires explicit Crustdata fields.`);
  }
}

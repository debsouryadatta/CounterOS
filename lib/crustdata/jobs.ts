import "server-only";

import { requestCrustdata } from "./client";
import { normalizeResultsEnvelope } from "./normalizers";
import type {
  CrustdataJobData,
  CrustdataRequestOptions,
  GenericSearchRequest,
  GenericSearchResponse
} from "./types";

export async function searchJobs<TJob = CrustdataJobData>(
  input: GenericSearchRequest,
  options?: CrustdataRequestOptions
): Promise<GenericSearchResponse<TJob>> {
  assertExplicitFields(input.fields, "searchJobs");

  const response = await requestCrustdata<unknown, GenericSearchRequest>({
    endpoint: "/job/search",
    method: "POST",
    body: input,
    ...options
  });

  return normalizeResultsEnvelope<TJob>(response, ["job_listings"]);
}

function assertExplicitFields(fields: readonly string[] | undefined, operation: string) {
  if (!fields || fields.length === 0 || fields.some((field) => field.trim().length === 0)) {
    throw new Error(`${operation} requires explicit Crustdata fields.`);
  }
}

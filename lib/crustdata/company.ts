import "server-only";

import { CrustdataError, requestCrustdata } from "./client";
import {
  normalizeCompanyMatchEnvelopes,
  normalizeCompanySearchResponse
} from "./normalizers";
import type {
  CompanyEnrichRequest,
  CompanyIdentifyRequest,
  CompanySearchRequest,
  CompanySearchResponse,
  CrustdataCompanyData,
  CrustdataCompanyMatchEnvelope,
  CrustdataRequestOptions,
  NonEmptyArray
} from "./types";

export async function identifyCompany(
  input: CompanyIdentifyRequest,
  options?: CrustdataRequestOptions
): Promise<CrustdataCompanyMatchEnvelope[]> {
  assertExactlyOneIdentifier(input, "identifyCompany");

  try {
    const response = await requestCrustdata<unknown, CompanyIdentifyRequest>({
      endpoint: "/company/identify",
      method: "POST",
      body: input,
      ...options
    });

    return normalizeCompanyMatchEnvelopes(response);
  } catch (error) {
    if (error instanceof CrustdataError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function searchCompanies<TCompany = CrustdataCompanyData>(
  input: CompanySearchRequest,
  options?: CrustdataRequestOptions
): Promise<CompanySearchResponse<TCompany>> {
  assertExplicitFields(input.fields, "searchCompanies");

  const response = await requestCrustdata<unknown, CompanySearchRequest>({
    endpoint: "/company/search",
    method: "POST",
    body: input,
    ...options
  });

  return normalizeCompanySearchResponse<TCompany>(response);
}

export async function enrichCompany(
  input: CompanyEnrichRequest,
  options?: CrustdataRequestOptions
): Promise<CrustdataCompanyMatchEnvelope[]> {
  assertExactlyOneIdentifier(input, "enrichCompany");
  assertExplicitFields(input.fields, "enrichCompany");

  const response = await requestCrustdata<unknown, CompanyEnrichRequest>({
    endpoint: "/company/enrich",
    method: "POST",
    body: input,
    ...options
  });

  return normalizeCompanyMatchEnvelopes(response);
}

function assertExplicitFields(
  fields: readonly string[] | undefined,
  operation: string
): asserts fields is NonEmptyArray<string> {
  if (!fields || fields.length === 0 || fields.some((field) => field.trim().length === 0)) {
    throw new Error(`${operation} requires explicit Crustdata fields.`);
  }
}

function assertExactlyOneIdentifier(
  input: Partial<CompanyIdentifyRequest | CompanyEnrichRequest>,
  operation: string
) {
  const identifierCount = [
    input.domains,
    input.names,
    input.professional_network_profile_urls,
    input.crustdata_company_ids
  ].filter((value) => Array.isArray(value) && value.length > 0).length;

  if (identifierCount !== 1) {
    throw new Error(`${operation} requires exactly one Crustdata company identifier type.`);
  }
}

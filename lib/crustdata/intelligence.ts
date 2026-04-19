import "server-only";

import type { CompetitorProfile, SuggestedCompetitor } from "@/lib/types";
import { CrustdataError } from "./client";
import { enrichCompany, identifyCompany, searchCompanies } from "./company";
import type {
  CompanyIdentifierInput,
  CrustdataCompanyData,
  CrustdataCompanyMatchEnvelope,
  NonEmptyArray
} from "./types";

export const COMPANY_DISCOVERY_FIELDS = [
  "crustdata_company_id",
  "basic_info.name",
  "basic_info.primary_domain",
  "basic_info.website",
  "basic_info.employee_count_range",
  "headcount.total",
  "funding.total_investment_usd",
  "funding.last_round_type",
  "competitors.websites"
] as NonEmptyArray<string>;

export const COMPANY_ENRICH_FIELDS = [
  "basic_info",
  "headcount",
  "funding",
  "hiring"
] as NonEmptyArray<string>;

export type CompanyIdentityResult = Pick<
  SuggestedCompetitor,
  | "intelligenceStatus"
  | "crustdataCompanyId"
  | "crustdataMatchConfidence"
  | "identifyError"
  | "identifiedAt"
> & {
  matchedName?: string;
  matchedDomain?: string;
  evidence: string[];
};

export type CompanyEnrichmentResult = Pick<
  CompetitorProfile,
  | "intelligenceStatus"
  | "crustdataCompanyId"
  | "crustdataMatchConfidence"
  | "crustdataProfile"
  | "enrichmentError"
  | "enrichedAt"
> & {
  headcount?: string;
  funding?: string;
  hiring?: string;
};

export async function resolveCompanyIdentity(input: {
  value: string;
  workspaceId?: string;
}): Promise<CompanyIdentityResult> {
  if (!process.env.CRUSTDATA_API_KEY) {
    return {
      intelligenceStatus: "unresolved",
      identifyError: "CRUSTDATA_API_KEY is not configured.",
      identifiedAt: null,
      evidence: ["Crustdata Identify skipped because no API key was configured."]
    };
  }

  const identifier = inferCompanyIdentifier(input.value);

  try {
    const envelopes = await identifyCompany(identifier, {
      cache: {
        workspaceId: input.workspaceId,
        ttlMs: 7 * 24 * 60 * 60 * 1000
      }
    });
    const match = pickBestCompanyMatch(envelopes);

    if (!match?.company) {
      return {
        intelligenceStatus: "no_match",
        identifyError: null,
        identifiedAt: new Date().toISOString(),
        evidence: ["Crustdata Identify did not return a confident company match."]
      };
    }

    return {
      intelligenceStatus: "resolved",
      crustdataCompanyId: match.company.crustdata_company_id ?? null,
      crustdataMatchConfidence: match.confidence,
      identifyError: null,
      identifiedAt: new Date().toISOString(),
      matchedName: match.company.basic_info?.name,
      matchedDomain:
        match.company.basic_info?.primary_domain ?? normalizeDomain(match.company.basic_info?.website),
      evidence: [
        `Crustdata Identify matched ${match.company.basic_info?.name ?? "a company"}.`,
        match.company.basic_info?.primary_domain
          ? `Primary domain: ${match.company.basic_info.primary_domain}.`
          : "Company domain was not returned by Identify."
      ]
    };
  } catch (error) {
    return {
      intelligenceStatus: "failed",
      identifyError: getErrorMessage(error),
      identifiedAt: new Date().toISOString(),
      evidence: [`Crustdata Identify failed: ${getErrorMessage(error)}`]
    };
  }
}

export async function enrichCompetitorCompany(input: {
  competitor: CompetitorProfile;
  workspaceId?: string;
}): Promise<CompanyEnrichmentResult> {
  if (!process.env.CRUSTDATA_API_KEY) {
    return {
      intelligenceStatus: "failed",
      enrichmentError: "CRUSTDATA_API_KEY is not configured.",
      enrichedAt: new Date().toISOString()
    };
  }

  const identifier = input.competitor.crustdataCompanyId
    ? ({ crustdata_company_ids: [input.competitor.crustdataCompanyId] } as CompanyIdentifierInput)
    : ({ domains: [input.competitor.domain] } as CompanyIdentifierInput);

  try {
    const envelopes = await enrichCompany(
      {
        ...identifier,
        fields: COMPANY_ENRICH_FIELDS
      },
      {
        maxRetries: 0,
        cache: {
          workspaceId: input.workspaceId,
          ttlMs: 24 * 60 * 60 * 1000
        }
      }
    );
    const match = pickBestCompanyMatch(envelopes);

    if (!match?.company) {
      return {
        intelligenceStatus: "no_match",
        enrichmentError: null,
        enrichedAt: new Date().toISOString()
      };
    }

    return {
      intelligenceStatus: "enriched",
      crustdataCompanyId: match.company.crustdata_company_id ?? input.competitor.crustdataCompanyId,
      crustdataMatchConfidence: match.confidence ?? input.competitor.crustdataMatchConfidence,
      crustdataProfile: match.company,
      enrichmentError: null,
      enrichedAt: new Date().toISOString(),
      headcount: formatHeadcount(match.company),
      funding: formatFunding(match.company),
      hiring: formatHiring(match.company)
    };
  } catch (error) {
    return {
      intelligenceStatus: "failed",
      enrichmentError: getErrorMessage(error),
      enrichedAt: new Date().toISOString()
    };
  }
}

export async function discoverCompanies(input: {
  query: string;
  limit?: number;
  workspaceId?: string;
}) {
  const response = await searchCompanies(
    {
      fields: COMPANY_DISCOVERY_FIELDS,
      filters: {
        op: "and",
        conditions: [
          {
            field: "basic_info.name",
            type: "contains",
            value: input.query
          }
        ]
      },
      limit: Math.min(Math.max(input.limit ?? 10, 1), 25)
    },
    {
      cache: {
        workspaceId: input.workspaceId,
        ttlMs: 24 * 60 * 60 * 1000
      }
    }
  );

  return response.companies;
}

export function inferCompanyIdentifier(value: string): CompanyIdentifierInput {
  const trimmed = value.trim();
  const normalized = normalizeDomain(trimmed);

  if (/^crustdata:/i.test(trimmed)) {
    return {
      crustdata_company_ids: [trimmed.replace(/^crustdata:/i, "").trim()]
    };
  }

  if (trimmed.includes("linkedin.com/") || trimmed.includes("crunchbase.com/")) {
    return {
      professional_network_profile_urls: [trimmed]
    };
  }

  if (normalized && normalized.includes(".")) {
    return {
      domains: [normalized]
    };
  }

  return {
    names: [trimmed]
  };
}

export function normalizeDomain(value?: string) {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function pickBestCompanyMatch(envelopes: CrustdataCompanyMatchEnvelope[]) {
  return envelopes
    .flatMap((envelope) => envelope.matches ?? [])
    .map((match) => ({
      confidence: normalizeConfidence(match.confidence_score),
      company: match.company_data
    }))
    .filter((match): match is { confidence: number | null; company: CrustdataCompanyData } =>
      Boolean(match.company)
    )
    .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0];
}

function normalizeConfidence(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value > 0 && value <= 1 ? value * 100 : value)));
}

function formatHeadcount(company: CrustdataCompanyData) {
  const headcount = getNestedNumber(company, ["headcount", "total"]);
  if (headcount !== null) {
    return `${headcount.toLocaleString()} employees`;
  }

  return company.basic_info?.employee_count_range ?? undefined;
}

function formatFunding(company: CrustdataCompanyData) {
  const total = getNestedNumber(company, ["funding", "total_investment_usd"]);
  const round = getNestedString(company, ["funding", "last_round_type"]);

  if (total !== null && round) {
    return `${round}, $${Math.round(total / 1_000_000).toLocaleString()}M raised`;
  }

  if (total !== null) {
    return `$${Math.round(total / 1_000_000).toLocaleString()}M raised`;
  }

  return round ?? undefined;
}

function formatHiring(company: CrustdataCompanyData) {
  const growth = getNestedNumber(company, ["hiring", "growth_6m"]);
  if (growth !== null) {
    return `Role growth over 6 months: ${growth}%`;
  }

  return undefined;
}

function getNestedNumber(object: unknown, path: string[]) {
  const value = getNestedValue(object, path);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedString(object: unknown, path: string[]) {
  const value = getNestedValue(object, path);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNestedValue(object: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, object);
}

function getErrorMessage(error: unknown) {
  if (error instanceof CrustdataError && error.status && error.status >= 500) {
    return "Crustdata is temporarily unavailable. Try enrichment again in a moment.";
  }

  return error instanceof Error ? error.message : "Unknown Crustdata error";
}

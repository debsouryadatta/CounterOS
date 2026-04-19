import { searchJobs } from "@/lib/crustdata/jobs";
import {
  createSignal,
  getCompetitor,
  listCompetitors,
  listSignals
} from "@/lib/db/queries";
import { detectJobSignalRules } from "@/lib/signals/rules";
import { scoreSignal } from "@/lib/signals/scoring";
import type { JobPostingSignalInput } from "@/lib/signals/types";
import type { CompetitorProfile, Signal } from "@/lib/types";

const JOB_FIELDS = [
  "crustdata_job_id",
  "job_details.title",
  "job_details.category",
  "job_details.url",
  "company.basic_info.name",
  "company.basic_info.primary_domain",
  "location.raw",
  "metadata.date_added"
] as [string, ...string[]];

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_DUPLICATE_WINDOW_DAYS = 14;

export type HiringSignalGenerationResult = {
  signals: Signal[];
  checkedCompetitors: number;
  checkedJobs: number;
  skippedDuplicates: number;
};

type CreateSignalInput = Parameters<typeof createSignal>[0];

export async function generateHiringSignalsForWorkspace(input: {
  workspaceId: string;
  competitorId?: string;
  limit?: number;
  cacheTtlMs?: number;
  duplicateWindowDays?: number;
}): Promise<HiringSignalGenerationResult> {
  const competitors = input.competitorId
    ? [getCompetitor(input.workspaceId, input.competitorId)].filter(
        (competitor): competitor is CompetitorProfile => Boolean(competitor)
      )
    : listCompetitors(input.workspaceId);
  const createdSignals: Signal[] = [];
  const knownSignals = listSignals(input.workspaceId);
  const duplicateWindowDays = input.duplicateWindowDays ?? DEFAULT_DUPLICATE_WINDOW_DAYS;
  let checkedJobs = 0;
  let skippedDuplicates = 0;

  for (const competitor of competitors) {
    const response = await searchJobs(
      {
        fields: JOB_FIELDS,
        filters: buildJobsFilter(competitor),
        sorts: [{ column: "metadata.date_added", order: "desc" }],
        limit: input.limit ?? 25
      },
      {
        cache: {
          workspaceId: input.workspaceId,
          ttlMs: input.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
        }
      }
    );
    const jobs = response.results.map(mapCrustdataJob);
    checkedJobs += jobs.length;
    const ruleMatches = detectJobSignalRules({
      competitorName: competitor.name,
      currentJobs: jobs,
      baselineJobCount: 0,
      knownGeographies: []
    });

    for (const match of ruleMatches) {
      const scored = scoreSignal({
        freshness: 90,
        confidence: match.confidence,
        competitorPriority: competitor.trackingPriority,
        customerImpact: match.customerImpact,
        actionability: match.actionability,
        evidenceCount: match.evidence.length
      });
      const candidate: CreateSignalInput = {
        workspaceId: input.workspaceId,
        competitor: competitor.name,
        title: match.title,
        summary: match.summary,
        impactScore: scored.impactScore,
        priority: scored.priority,
        evidence: match.evidence.map((evidence) => ({
          source: evidence.source,
          detail: evidence.detail,
          freshness: evidence.observedAt ?? "Recent",
          url: evidence.url
        })),
        meaning:
          "Crustdata job evidence suggests this competitor may be changing focus, capacity, or go-to-market motion.",
        recommendedMove:
          "Review the evidence, compare it with positioning or pricing changes, and decide whether to create a counter-move.",
        counterMoves: {
          defensive:
            "Prepare messaging that protects your current wedge against the competitor's apparent hiring direction.",
          offensive:
            "Look for accounts that may not fit the competitor's new hiring focus and target them early.",
          ignore:
            "Ignore if the hiring pattern does not overlap your ICP or has low evidence confidence."
        }
      };

      if (hasRecentDuplicateSignal(knownSignals, candidate, duplicateWindowDays)) {
        skippedDuplicates += 1;
        continue;
      }

      const signal = createSignal(candidate);
      knownSignals.push(signal);
      createdSignals.push(signal);
    }
  }

  return {
    signals: createdSignals,
    checkedCompetitors: competitors.length,
    checkedJobs,
    skippedDuplicates
  };
}

function buildJobsFilter(competitor: CompetitorProfile) {
  const conditions = competitor.crustdataCompanyId
    ? [
        {
          field: "company.basic_info.company_id",
          type: "=",
          value: numericOrString(competitor.crustdataCompanyId)
        }
      ]
    : [
        {
          field: "company.basic_info.primary_domain",
          type: "=",
          value: competitor.domain
        }
      ];

  return {
    op: "and" as const,
    conditions
  };
}

function mapCrustdataJob(job: Record<string, unknown>): JobPostingSignalInput {
  return {
    id: readString(job.crustdata_job_id ?? job.id),
    title: readString(readPath(job, "job_details.title") ?? job.title) ?? "Untitled role",
    companyName: readString(readPath(job, "company.basic_info.name") ?? job.company_name),
    location: readString(readPath(job, "location.raw") ?? job.location),
    department: readString(readPath(job, "job_details.category") ?? job.department),
    postedAt: readString(readPath(job, "metadata.date_added") ?? job.date_posted),
    url: readString(readPath(job, "job_details.url") ?? job.url)
  };
}

function hasRecentDuplicateSignal(
  existingSignals: Signal[],
  candidate: CreateSignalInput,
  windowDays: number
) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const candidateTitle = normalizeComparable(candidate.title);
  const candidateCompetitor = normalizeComparable(candidate.competitor);

  return existingSignals.some((signal) => {
    const detectedAt = Date.parse(signal.detectedAt);

    if (Number.isFinite(detectedAt) && detectedAt < cutoff) {
      return false;
    }

    return (
      normalizeComparable(signal.competitor) === candidateCompetitor &&
      normalizeComparable(signal.title) === candidateTitle
    );
  });
}

function readPath(value: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numericOrString(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { CrustdataError } from "@/lib/crustdata/client";
import { searchJobs } from "@/lib/crustdata/jobs";
import { createSignal, getCompetitor, listCompetitors } from "@/lib/db/queries";
import { detectJobSignalRules } from "@/lib/signals/rules";
import { scoreSignal } from "@/lib/signals/scoring";
import type { JobPostingSignalInput } from "@/lib/signals/types";
import type { CompetitorProfile } from "@/lib/types";

export const runtime = "nodejs";

const generateSignalsSchema = z
  .object({
    competitorId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(25)
  })
  .strict();

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

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = generateSignalsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid signal generation request." },
      { status: 400 }
    );
  }

  if (!process.env.CRUSTDATA_API_KEY) {
    return NextResponse.json({ error: "CRUSTDATA_API_KEY is not configured." }, { status: 503 });
  }

  const competitors = parsed.data.competitorId
    ? [getCompetitor(auth.workspace.id, parsed.data.competitorId)].filter(
        (competitor): competitor is CompetitorProfile => Boolean(competitor)
      )
    : listCompetitors(auth.workspace.id);
  const createdSignals = [];

  for (const competitor of competitors) {
    try {
      const response = await searchJobs(
        {
          fields: JOB_FIELDS,
          filters: buildJobsFilter(competitor),
          sorts: [{ column: "metadata.date_added", order: "desc" }],
          limit: parsed.data.limit
        },
        {
          cache: {
            workspaceId: auth.workspace.id,
            ttlMs: 6 * 60 * 60 * 1000
          }
        }
      );
      const jobs = response.results.map(mapCrustdataJob);
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
        createdSignals.push(
          createSignal({
            workspaceId: auth.workspace.id,
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
          })
        );
      }
    } catch (error) {
      if (error instanceof CrustdataError) {
        return NextResponse.json(
          {
            error: error.message,
            provider: "crustdata",
            endpoint: error.endpoint,
            status: error.status,
            responseBody: error.responseBody
          },
          { status: 502 }
        );
      }

      throw error;
    }
  }

  return NextResponse.json({ signals: createdSignals });
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

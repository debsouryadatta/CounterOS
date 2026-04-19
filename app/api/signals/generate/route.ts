import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
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
  "title",
  "company_name",
  "company_domain",
  "location",
  "date_posted",
  "url",
  "department",
  "seniority"
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
    const response = await searchJobs(
      {
        fields: JOB_FIELDS,
        filters: {
          op: "or",
          conditions: [
            { field: "company_name", type: "=", value: competitor.name },
            { field: "company_domain", type: "=", value: competitor.domain }
          ]
        },
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
  }

  return NextResponse.json({ signals: createdSignals });
}

function mapCrustdataJob(job: Record<string, unknown>): JobPostingSignalInput {
  return {
    id: readString(job.id),
    title: readString(job.title) ?? "Untitled role",
    companyName: readString(job.company_name),
    location: readString(job.location),
    department: readString(job.department),
    seniority: readString(job.seniority),
    postedAt: readString(job.date_posted),
    url: readString(job.url)
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

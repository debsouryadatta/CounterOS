import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { enrichCompetitorCompany } from "@/lib/crustdata/intelligence";
import { decideSuggestedCompetitor, updateCompetitor } from "@/lib/db/queries";
import {
  suggestedCompetitorDecisionSchema,
  suggestedCompetitorIdParamsSchema
} from "@/lib/validation/competitors";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const parsedParams = suggestedCompetitorIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid suggested competitor id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = suggestedCompetitorDecisionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  const result = decideSuggestedCompetitor({
    workspaceId: auth.workspace.id,
    suggestionId: parsedParams.data.id,
    decision: parsed.data.decision,
    reason: parsed.data.reason
  });

  if (!result?.suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  if (result.competitor && parsed.data.decision === "approved") {
    const enrichment = await enrichCompetitorCompany({
      competitor: result.competitor,
      workspaceId: auth.workspace.id
    });
    const competitor = updateCompetitor({
      workspaceId: auth.workspace.id,
      competitorId: result.competitor.id,
      updates: {
        intelligenceStatus: enrichment.intelligenceStatus,
        crustdataCompanyId: enrichment.crustdataCompanyId,
        crustdataMatchConfidence: enrichment.crustdataMatchConfidence,
        crustdataProfile: enrichment.crustdataProfile,
        enrichmentError: enrichment.enrichmentError,
        enrichedAt: enrichment.enrichedAt,
        ...(enrichment.headcount ? { headcount: enrichment.headcount } : {}),
        ...(enrichment.funding ? { funding: enrichment.funding } : {}),
        ...(enrichment.hiring ? { hiring: enrichment.hiring } : {})
      }
    });

    return NextResponse.json({
      ...result,
      competitor: competitor ?? result.competitor
    });
  }

  return NextResponse.json(result);
}

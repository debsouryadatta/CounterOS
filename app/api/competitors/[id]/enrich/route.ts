import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { enrichCompetitorCompany } from "@/lib/crustdata/intelligence";
import { getCompetitor, updateCompetitor } from "@/lib/db/queries";
import { competitorIdParamsSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<unknown> }
) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const parsedParams = competitorIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid competitor id." }, { status: 400 });
  }

  const existing = getCompetitor(auth.workspace.id, parsedParams.data.id);

  if (!existing) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  const enrichment = await enrichCompetitorCompany({
    competitor: existing,
    workspaceId: auth.workspace.id
  });
  const competitor = updateCompetitor({
    workspaceId: auth.workspace.id,
    competitorId: existing.id,
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

  return NextResponse.json({ competitor: competitor ?? existing });
}

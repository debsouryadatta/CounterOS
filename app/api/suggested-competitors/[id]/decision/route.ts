import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { decideSuggestedCompetitor } from "@/lib/db/queries";
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
    decision: parsed.data.decision
  });

  if (!result?.suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}

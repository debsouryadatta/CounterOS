import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  deleteSuggestedCompetitor,
  getSuggestedCompetitor,
  updateSuggestedCompetitor
} from "@/lib/db/queries";
import {
  suggestedCompetitorIdParamsSchema,
  updateSuggestedCompetitorSchema
} from "@/lib/validation/competitors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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

  const suggestion = getSuggestedCompetitor(auth.workspace.id, parsedParams.data.id);

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json({ suggestion });
}

export async function PATCH(
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
  const parsed = updateSuggestedCompetitorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid suggested competitor." },
      { status: 400 }
    );
  }

  const suggestion = updateSuggestedCompetitor({
    workspaceId: auth.workspace.id,
    suggestionId: parsedParams.data.id,
    updates: parsed.data
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json({ suggestion });
}

export async function DELETE(
  _request: Request,
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

  const deleted = deleteSuggestedCompetitor(auth.workspace.id, parsedParams.data.id);

  if (!deleted) {
    return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

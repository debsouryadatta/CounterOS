import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  deleteCompetitor,
  getCompetitor,
  getCompetitorByDomain,
  updateCompetitor
} from "@/lib/db/queries";
import {
  competitorIdParamsSchema,
  updateCompetitorSchema
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
  const parsedParams = competitorIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid competitor id." }, { status: 400 });
  }

  const competitor = getCompetitor(auth.workspace.id, parsedParams.data.id);

  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  return NextResponse.json({ competitor });
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
  const parsedParams = competitorIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid competitor id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateCompetitorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid competitor." },
      { status: 400 }
    );
  }

  if (parsed.data.domain) {
    const existing = getCompetitorByDomain(auth.workspace.id, parsed.data.domain);

    if (existing && existing.id !== parsedParams.data.id) {
      return NextResponse.json(
        { error: "A competitor with that domain already exists." },
        { status: 409 }
      );
    }
  }

  const competitor = updateCompetitor({
    workspaceId: auth.workspace.id,
    competitorId: parsedParams.data.id,
    updates: parsed.data
  });

  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  return NextResponse.json({ competitor });
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
  const parsedParams = competitorIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid competitor id." }, { status: 400 });
  }

  const deleted = deleteCompetitor(auth.workspace.id, parsedParams.data.id);

  if (!deleted) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }

  return NextResponse.json({
    deleted: true,
    competitor: deleted.competitor,
    pausedTrackedPages: deleted.pausedTrackedPages
  });
}

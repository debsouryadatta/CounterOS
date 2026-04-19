import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  createCompetitor,
  getCompetitorByDomain,
  listCompetitors
} from "@/lib/db/queries";
import { createCompetitorSchema } from "@/lib/validation/competitors";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const competitors = listCompetitors(auth.workspace.id);

  return NextResponse.json({ competitors });
}

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createCompetitorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid competitor." },
      { status: 400 }
    );
  }

  const existing = getCompetitorByDomain(auth.workspace.id, parsed.data.domain);

  if (existing) {
    return NextResponse.json(
      { error: "A competitor with that domain already exists." },
      { status: 409 }
    );
  }

  const competitor = createCompetitor({
    workspaceId: auth.workspace.id,
    competitor: parsed.data
  });

  return NextResponse.json({ competitor }, { status: 201 });
}

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  createTrackedPage,
  getCompetitor,
  getTrackedPageByUrl,
  listTrackedPages
} from "@/lib/db/queries";
import { createTrackedPageSchema } from "@/lib/validation/pages";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({ trackedPages: listTrackedPages(auth.workspace.id) });
}

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createTrackedPageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid tracked page." },
      { status: 400 }
    );
  }

  if (parsed.data.competitorId) {
    const competitor = getCompetitor(auth.workspace.id, parsed.data.competitorId);

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
    }
  }

  const existing = getTrackedPageByUrl(auth.workspace.id, parsed.data.url);

  if (existing) {
    return NextResponse.json(
      { error: "That page is already tracked.", trackedPage: existing },
      { status: 409 }
    );
  }

  const trackedPage = createTrackedPage({
    workspaceId: auth.workspace.id,
    competitorId: parsed.data.competitorId,
    url: parsed.data.url,
    pageType: parsed.data.pageType
  });

  return NextResponse.json({ trackedPage }, { status: 201 });
}

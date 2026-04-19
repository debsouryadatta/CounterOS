import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  createSuggestedCompetitor,
  listSuggestedCompetitors
} from "@/lib/db/queries";
import {
  createSuggestedCompetitorSchema,
  normalizeDomain
} from "@/lib/validation/competitors";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const suggestions = listSuggestedCompetitors(auth.workspace.id);

  return NextResponse.json({ suggestions });
}

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSuggestedCompetitorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a competitor name or domain." }, { status: 400 });
  }

  const cleanDomain = normalizeDomain(parsed.data.value);

  const name = cleanDomain
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const suggestion = createSuggestedCompetitor({
    workspaceId: auth.workspace.id,
    name,
    domain: cleanDomain,
    description: "Manually added competitor waiting for Identify and enrichment."
  });

  return NextResponse.json({ suggestion });
}

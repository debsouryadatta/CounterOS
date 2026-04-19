import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { resolveCompanyIdentity } from "@/lib/crustdata/intelligence";
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

  const identity = await resolveCompanyIdentity({
    value: parsed.data.value,
    workspaceId: auth.workspace.id
  });
  const cleanDomain = identity.matchedDomain
    ? normalizeDomain(identity.matchedDomain)
    : normalizeDomain(parsed.data.value);

  const name = (identity.matchedName || cleanDomain)
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const suggestion = createSuggestedCompetitor({
    workspaceId: auth.workspace.id,
    name,
    domain: cleanDomain,
    description:
      identity.intelligenceStatus === "resolved"
        ? "Resolved by Crustdata Identify and waiting for founder approval."
        : "Manually added competitor waiting for Identify and enrichment.",
    evidence: identity.evidence,
    intelligenceStatus: identity.intelligenceStatus,
    crustdataCompanyId: identity.crustdataCompanyId,
    crustdataMatchConfidence: identity.crustdataMatchConfidence,
    identifyError: identity.identifyError,
    identifiedAt: identity.identifiedAt
  });

  return NextResponse.json({ suggestion });
}

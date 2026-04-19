import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  createPageSnapshot,
  createSignal,
  getCompetitor,
  getLatestPageSnapshot,
  getTrackedPage,
  markTrackedPageFailed
} from "@/lib/db/queries";
import { fetchPageText, summarizeTextDiff } from "@/lib/pages/fetch";
import { trackedPageIdParamsSchema } from "@/lib/validation/pages";

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
  const parsedParams = trackedPageIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tracked page id." }, { status: 400 });
  }

  const trackedPage = getTrackedPage(auth.workspace.id, parsedParams.data.id);

  if (!trackedPage) {
    return NextResponse.json({ error: "Tracked page not found." }, { status: 404 });
  }

  try {
    const latest = getLatestPageSnapshot(auth.workspace.id, trackedPage.id);
    const fetched = await fetchPageText(trackedPage.url);
    const snapshot = createPageSnapshot({
      workspaceId: auth.workspace.id,
      trackedPageId: trackedPage.id,
      url: fetched.url,
      title: fetched.title,
      extractedText: fetched.extractedText,
      diffSummary: summarizeTextDiff(latest?.extractedText ?? null, fetched.extractedText)
    });
    const shouldCreateSignal =
      latest &&
      snapshot.diffSummary &&
      !snapshot.diffSummary.includes("No meaningful text changes detected");
    const competitor = trackedPage.competitorId
      ? getCompetitor(auth.workspace.id, trackedPage.competitorId)
      : null;
    const signal = shouldCreateSignal
      ? createSignal({
          workspaceId: auth.workspace.id,
          competitor: competitor?.name ?? new URL(trackedPage.url).hostname,
          title: `${trackedPage.pageType} page changed`,
          summary: snapshot.diffSummary ?? "Tracked page text changed.",
          impactScore: 62,
          priority: "Verify",
          evidence: [
            {
              source: "Page snapshot",
              detail: snapshot.diffSummary ?? "Tracked page text changed.",
              freshness: snapshot.fetchedAt,
              url: snapshot.url
            }
          ],
          meaning:
            "A tracked competitor page changed. This needs interpretation before it becomes a counter-move.",
          recommendedMove:
            "Review the changed terms, compare against pricing or positioning, and decide whether to ask the agent for a counter-move.",
          counterMoves: {
            defensive: "Update positioning if the change attacks your current wedge.",
            offensive: "Use any new complexity or repositioning as contrast in sales conversations.",
            ignore: "Ignore if the change is cosmetic or unrelated to your buyer."
          }
        })
      : null;

    return NextResponse.json({ snapshot, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown page fetch error";
    markTrackedPageFailed({
      workspaceId: auth.workspace.id,
      trackedPageId: trackedPage.id,
      error: message
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}

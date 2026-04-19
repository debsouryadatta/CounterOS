import {
  createPageSnapshot,
  createSignal,
  getCompetitor,
  getLatestPageSnapshot,
  getTrackedPage,
  markTrackedPageFailed
} from "@/lib/db/queries";
import type { PageSnapshot, Signal } from "@/lib/types";
import { fetchPageText, summarizeTextDiff } from "./fetch";

export async function snapshotTrackedPage(input: {
  workspaceId: string;
  trackedPageId: string;
}): Promise<{
  snapshot: PageSnapshot;
  signal: Signal | null;
}> {
  const trackedPage = getTrackedPage(input.workspaceId, input.trackedPageId);

  if (!trackedPage) {
    throw new Error("Tracked page not found.");
  }

  try {
    const latest = getLatestPageSnapshot(input.workspaceId, trackedPage.id);
    const fetched = await fetchPageText(trackedPage.url);
    const snapshot = createPageSnapshot({
      workspaceId: input.workspaceId,
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
      ? getCompetitor(input.workspaceId, trackedPage.competitorId)
      : null;
    const signal = shouldCreateSignal
      ? createSignal({
          workspaceId: input.workspaceId,
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

    return { snapshot, signal };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown page fetch error";
    markTrackedPageFailed({
      workspaceId: input.workspaceId,
      trackedPageId: trackedPage.id,
      error: message
    });

    throw error;
  }
}

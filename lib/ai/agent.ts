import "server-only";

import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent, type InferAgentUIMessage } from "ai";
import { getWorkspaceAgentContext } from "@/lib/db/queries";
import { createCounterOSTools } from "./counteros-tools";
import { buildCounterOSAgentSystemPrompt } from "./prompts";

export function createCounterOSAgent(workspaceId: string) {
  const context = getWorkspaceAgentContext(workspaceId);
  const pendingSuggestions = context.suggestedCompetitors.filter(
    (suggestion) => suggestion.status === "pending"
  );
  const instructions = [
    buildCounterOSAgentSystemPrompt({
      productName: context.productProfile?.name,
      productDescription: context.productProfile?.description,
      icp: context.productProfile?.icp,
      category: context.productProfile?.category,
      geography: context.productProfile?.geography,
      knownCompetitors: context.competitors.map((competitor) => competitor.name),
      pendingSuggestions: pendingSuggestions.map(
        (suggestion) => `${suggestion.name} (${suggestion.domain}, id: ${suggestion.id})`
      )
    }),
    "",
    "You now run through Vercel AI SDK tool calls. Use tools to do real workspace work, then write a concise final response.",
    "Tool-use rules:",
    "- For approval and rejection, call approveSuggestion or rejectSuggestion only when the founder explicitly asks to approve, accept, reject, decline, or dismiss a pending suggestion.",
    "- For provider discovery, call discoverCompetitors when the founder asks to find, discover, search, fetch, or look up competitors, rivals, or alternatives.",
    "- For a named company that the founder explicitly asks to add or save, call saveCompetitorSuggestion instead of inventing a database write in prose.",
    "- For battlecards, target-account requests, and positioning memos, draft the content and call saveArtifact only when the founder asks to create or save the artifact.",
    "- For page monitoring, call trackPage when the founder asks to track, monitor, or watch a URL. Set snapshotNow when they ask to fetch, check, capture, or snapshot it now.",
    "- For an already-tracked URL or tracked page id, call snapshotTrackedPage when the founder asks for a fresh snapshot or page check.",
    "- If a target is ambiguous, ask one short clarifying question instead of taking action.",
    "- Never claim a provider lookup, database write, approval, rejection, enrichment, or page fetch happened unless a tool result says it happened.",
    "- Summarize tool results plainly in the final answer and mention any controlled provider failures without blaming the user.",
    "- Keep the final answer founder-facing: what changed, what needs review, and the next useful step."
  ].join("\n");

  return new ToolLoopAgent({
    id: "counteros-workspace-agent",
    model: openai(process.env.COUNTEROS_OPENAI_MODEL ?? "gpt-5.4-mini"),
    instructions,
    tools: createCounterOSTools(workspaceId),
    stopWhen: stepCountIs(8),
    maxOutputTokens: 2200
  });
}

export type CounterOSAgentUIMessage = InferAgentUIMessage<
  ReturnType<typeof createCounterOSAgent>
>;

export function extractTextFromUIMessage(message: {
  parts: Array<{ type: string; text?: string }>;
}) {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

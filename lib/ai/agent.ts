import "server-only";

import { z } from "zod";
import {
  createArtifact,
  createSuggestedCompetitor,
  getWorkspaceAgentContext,
  recordAgentActivity
} from "@/lib/db/queries";
import type { AgentActivity, Artifact, ChatMessage, SuggestedCompetitor } from "@/lib/types";
import { normalizeDomain } from "@/lib/validation/competitors";
import { buildCounterlessAgentSystemPrompt } from "./prompts";
import {
  agentActivityStepSchema,
  battlecardArtifactSchema,
  competitorSuggestionSchema,
  targetAccountRequestSchema
} from "./schemas";
import { createOpenAITextResponse, OpenAIClientError } from "./openai-client";

const agentChatOutputSchema = z
  .object({
    reply: z.string().trim().min(1),
    suggestedCompetitors: z.array(competitorSuggestionSchema).default([]),
    artifact: z
      .union([battlecardArtifactSchema, targetAccountRequestSchema])
      .optional(),
    activity: z.array(agentActivityStepSchema).default([])
  })
  .strict();

export type AgentChatResult = {
  reply: string;
  suggestedCompetitors: SuggestedCompetitor[];
  artifact: Artifact | null;
  activities: AgentActivity[];
};

export async function runCounterlessAgentChat(input: {
  workspaceId: string;
  userText: string;
  recentMessages: ChatMessage[];
}): Promise<AgentChatResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      reply:
        "I saved your message, but OPENAI_API_KEY is not configured for real agent work yet.",
      suggestedCompetitors: [],
      artifact: null,
      activities: [
        recordAgentActivity({
          workspaceId: input.workspaceId,
          label: "Check OpenAI configuration",
          source: "OpenAI",
          status: "Needs approval",
          evidence: "OPENAI_API_KEY is missing, so the agent used the fallback response."
        })
      ]
    };
  }

  const context = getWorkspaceAgentContext(input.workspaceId);
  const systemPrompt = buildCounterlessAgentSystemPrompt({
    productName: context.productProfile?.name,
    productDescription: context.productProfile?.description,
    icp: context.productProfile?.icp,
    category: context.productProfile?.category,
    geography: context.productProfile?.geography,
    knownCompetitors: context.competitors.map((competitor) => competitor.name),
    pendingSuggestions: context.suggestedCompetitors
      .filter((suggestion) => suggestion.status === "pending")
      .map((suggestion) => suggestion.name)
  });

  const instruction = [
    systemPrompt,
    "",
    "Return only JSON with this shape:",
    JSON.stringify({
      reply: "A concise founder-facing response.",
      suggestedCompetitors: [
        {
          name: "Company name",
          domain: "company.com",
          description: "Why this may be a competitor.",
          threatType: "Direct",
          confidence: 70,
          priority: "Medium",
          evidence: ["Evidence point"],
          status: "pending"
        }
      ],
      artifact: {
        type: "Battlecard",
        competitor: "Company name",
        title: "Artifact title",
        summary: "Short summary",
        bullets: ["Useful sales note"],
        strengths: ["Competitor strength"],
        weaknesses: ["Competitor weakness"],
        objections: [
          {
            objection: "Buyer objection",
            response: "Response",
            evidence: [
              {
                source: "Workspace",
                detail: "Evidence detail",
                freshness: "Current"
              }
            ]
          }
        ],
        talkTracks: ["Talk track"],
        counterMoves: {
          defensive: "Defensive move",
          offensive: "Offensive move",
          ignore: "Ignore condition"
        },
        approvalStatus: "pending"
      },
      activity: [
        {
          label: "What the agent did",
          source: "Agent",
          status: "Needs approval",
          evidence: "What evidence supports the step"
        }
      ]
    }),
    "Rules:",
    "- If the user asks to find competitors, return 2-5 suggestedCompetitors.",
    "- If the user asks for a battlecard, target accounts, artifact, memo, or counter-move, return one artifact.",
    "- Do not approve competitors. All suggested competitors must have status pending.",
    "- Do not claim Crustdata/web/page fetching ran unless explicit data is present in the context."
  ].join("\n");

  try {
    const outputText = await createOpenAITextResponse({
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: instruction }]
        },
        ...input.recentMessages.slice(-8).map((message) => ({
          role: message.role === "agent" ? ("assistant" as const) : ("user" as const),
          content: [{ type: "input_text" as const, text: message.text }]
        })),
        {
          role: "user",
          content: [{ type: "input_text", text: input.userText }]
        }
      ]
    });
    const parsed = agentChatOutputSchema.safeParse(parseJsonObject(outputText));

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Agent output did not match schema.");
    }

    return persistAgentOutput(input.workspaceId, parsed.data);
  } catch (error) {
    const message =
      error instanceof OpenAIClientError
        ? `OpenAI request failed: ${error.message}`
        : `Agent output failed validation: ${error instanceof Error ? error.message : "unknown error"}`;

    const activity = recordAgentActivity({
      workspaceId: input.workspaceId,
      label: "Generate agent response",
      source: "Agent",
      status: "Needs approval",
      evidence: message
    });

    return {
      reply: `${message}. I saved the message so you can retry after fixing the issue.`,
      suggestedCompetitors: [],
      artifact: null,
      activities: [activity]
    };
  }
}

function persistAgentOutput(
  workspaceId: string,
  output: z.infer<typeof agentChatOutputSchema>
): AgentChatResult {
  const suggestedCompetitors = output.suggestedCompetitors.map((suggestion) =>
    createSuggestedCompetitor({
      workspaceId,
      name: suggestion.name,
      domain: normalizeDomain(suggestion.domain),
      description: suggestion.description,
      threatType: suggestion.threatType,
      confidence: suggestion.confidence,
      priority: suggestion.priority,
      evidence: suggestion.evidence,
      intelligenceStatus: "unresolved"
    })
  );

  const artifact = output.artifact ? persistArtifact(workspaceId, output.artifact) : null;

  const activities =
    output.activity.length > 0
      ? output.activity.map((activity) =>
          recordAgentActivity({
            workspaceId,
            label: activity.label,
            source: activity.source,
            status: activity.status,
            evidence: activity.evidence
          })
        )
      : [
          recordAgentActivity({
            workspaceId,
            label: "Generate agent response",
            source: "OpenAI",
            status: "Done",
            evidence: "Agent returned a structured response."
          })
        ];

  return {
    reply: output.reply,
    suggestedCompetitors,
    artifact,
    activities
  };
}

function persistArtifact(
  workspaceId: string,
  artifact: z.infer<typeof battlecardArtifactSchema> | z.infer<typeof targetAccountRequestSchema>
) {
  if (artifact.type === "Battlecard") {
    return createArtifact({
      workspaceId,
      type: "Battlecard",
      title: artifact.title,
      summary: artifact.summary,
      bullets: [
        ...artifact.bullets,
        ...artifact.strengths.map((item) => `Strength: ${item}`),
        ...artifact.weaknesses.map((item) => `Weakness: ${item}`),
        ...artifact.talkTracks.map((item) => `Talk track: ${item}`)
      ].slice(0, 12)
    });
  }

  return createArtifact({
    workspaceId,
    type: "Target accounts",
    title: artifact.title,
    summary: `${artifact.icp} in ${artifact.geography}. ${artifact.competitorContext}`,
    bullets: [
      `Category: ${artifact.category}`,
      ...artifact.buyingTriggers.map((item) => `Trigger: ${item}`),
      ...artifact.exclusions.map((item) => `Exclude: ${item}`)
    ].slice(0, 12)
  });
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("Agent did not return JSON.");
  }
}

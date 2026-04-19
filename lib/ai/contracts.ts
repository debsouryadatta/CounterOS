import type { ZodType } from "zod";
import {
  agentActivityStepSchema,
  battlecardArtifactSchema,
  competitorSuggestionSchema,
  counterMovePlanSchema,
  signalExplanationSchema,
  targetAccountRequestSchema
} from "./schemas";

export type StructuredOutputContract<TSchema extends ZodType = ZodType> = {
  name: string;
  description: string;
  schema: TSchema;
  approvalSafeNotes: readonly string[];
};

export const approvalSafeAgentRules = [
  "Suggested competitors are proposals, not tracked competitors.",
  "The agent must output suggested competitors with status pending.",
  "The agent must not approve, reject, or silently track a competitor without an explicit founder decision.",
  "When evidence is thin or conflicting, the agent should ask for verification or mark the work as Needs approval.",
  "Counter-moves and artifacts are recommendations until the founder accepts, edits, or ignores them."
] as const;

export const aiStructuredOutputContracts = {
  competitorSuggestion: {
    name: "competitor_suggestion",
    description:
      "A suggested competitor card for the approval queue. It can be reviewed, verified, approved, or rejected later.",
    schema: competitorSuggestionSchema,
    approvalSafeNotes: [
      "status must be pending",
      "do not create an approved competitor from this output",
      "include evidence strong enough for founder review"
    ]
  },
  signalExplanation: {
    name: "signal_explanation",
    description:
      "An explanation of a competitor signal with evidence, meaning, impact, and recommended counter-moves.",
    schema: signalExplanationSchema,
    approvalSafeNotes: [
      "ground the explanation in evidence",
      "use Verify priority when confidence is not actionable",
      "do not imply the founder has accepted the recommended move"
    ]
  },
  counterMovePlan: {
    name: "counter_move_plan",
    description:
      "A recommended plan that turns a signal into defensive, offensive, or ignore counter-moves.",
    schema: counterMovePlanSchema,
    approvalSafeNotes: [
      "approvalStatus must be pending",
      "steps can recommend action but cannot mark work as completed",
      "flag founder-facing decisions with approvalRequired"
    ]
  },
  battlecardArtifact: {
    name: "battlecard_artifact",
    description:
      "A Battlecard artifact draft with evidence-backed bullets, objections, talk tracks, and counter-moves.",
    schema: battlecardArtifactSchema,
    approvalSafeNotes: [
      "approvalStatus must be pending",
      "present the artifact as a draft",
      "cite evidence for claims used in objections or talk tracks"
    ]
  },
  targetAccountRequest: {
    name: "target_account_request",
    description:
      "A Target accounts request that describes the ICP, geography, buying triggers, exclusions, and evidence for a future search.",
    schema: targetAccountRequestSchema,
    approvalSafeNotes: [
      "approvalStatus must be pending",
      "describe the requested search without calling an external API",
      "keep exclusions explicit so future tooling can avoid noisy accounts"
    ]
  },
  agentActivityStep: {
    name: "agent_activity_step",
    description:
      "One persisted activity-stream step showing what the agent did, where it came from, and what evidence supports it.",
    schema: agentActivityStepSchema,
    approvalSafeNotes: [
      "use Needs approval when founder review is required",
      "use Queued for planned work that has not run",
      "keep evidence concise and inspectable"
    ]
  }
} as const satisfies Record<string, StructuredOutputContract>;

export type AiStructuredOutputContractName = keyof typeof aiStructuredOutputContracts;
export type AiStructuredOutputContract =
  (typeof aiStructuredOutputContracts)[AiStructuredOutputContractName];

export function getStructuredOutputContract(
  name: AiStructuredOutputContractName
): AiStructuredOutputContract {
  return aiStructuredOutputContracts[name];
}

export function listStructuredOutputContracts(): AiStructuredOutputContract[] {
  return Object.values(aiStructuredOutputContracts);
}

export function getApprovalSafeAgentRules(): string[] {
  return [...approvalSafeAgentRules];
}

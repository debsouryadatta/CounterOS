import { z } from "zod";

const scoreSchema = z.number().int().min(0).max(100);
const textSchema = z.string().trim().min(1);

export const threatTypeSchema = z.enum([
  "Direct",
  "Indirect",
  "Substitute",
  "Emerging",
  "Enterprise"
]);

export const suggestionPrioritySchema = z.enum(["High", "Medium", "Low"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const signalPrioritySchema = z.enum(["Act now", "Watch", "Verify", "Ignore"]);
export const activityStatusSchema = z.enum([
  "Done",
  "Running",
  "Needs approval",
  "Queued"
]);
export const artifactTypeSchema = z.enum([
  "Battlecard",
  "Target accounts",
  "Positioning memo"
]);

export const evidenceSchema = z
  .object({
    source: textSchema,
    detail: textSchema,
    freshness: textSchema,
    url: z.string().url().optional(),
    confidence: scoreSchema.optional()
  })
  .strict();

export const counterMovesSchema = z
  .object({
    defensive: textSchema,
    offensive: textSchema,
    ignore: textSchema
  })
  .strict();

export const competitorSuggestionSchema = z
  .object({
    name: textSchema,
    domain: textSchema,
    description: textSchema,
    threatType: threatTypeSchema,
    confidence: scoreSchema,
    priority: suggestionPrioritySchema,
    evidence: z.array(textSchema).min(1).max(8),
    status: z.literal("pending")
  })
  .strict();

export const signalExplanationSchema = z
  .object({
    competitor: textSchema,
    title: textSchema,
    summary: textSchema,
    impactScore: scoreSchema,
    priority: signalPrioritySchema,
    detectedAt: textSchema.optional(),
    evidence: z.array(evidenceSchema).min(1).max(10),
    meaning: textSchema,
    recommendedMove: textSchema,
    counterMoves: counterMovesSchema
  })
  .strict();

export const counterMoveStepSchema = z
  .object({
    label: textSchema,
    channel: z.enum(["Product", "Pricing", "Sales", "Marketing", "Founder", "Other"]),
    rationale: textSchema,
    approvalRequired: z.boolean()
  })
  .strict();

export const counterMovePlanSchema = z
  .object({
    competitor: textSchema,
    signalTitle: textSchema,
    objective: textSchema,
    recommendedMove: textSchema,
    priority: signalPrioritySchema,
    evidence: z.array(evidenceSchema).min(1).max(10),
    counterMoves: counterMovesSchema,
    steps: z.array(counterMoveStepSchema).min(1).max(6),
    artifactsToCreate: z.array(artifactTypeSchema).max(3),
    approvalStatus: z.literal("pending")
  })
  .strict();

export const battlecardObjectionSchema = z
  .object({
    objection: textSchema,
    response: textSchema,
    evidence: z.array(evidenceSchema).min(1).max(4)
  })
  .strict();

export const battlecardArtifactSchema = z
  .object({
    type: z.literal("Battlecard"),
    competitor: textSchema,
    title: textSchema,
    summary: textSchema,
    bullets: z.array(textSchema).min(1).max(8),
    strengths: z.array(textSchema).min(1).max(6),
    weaknesses: z.array(textSchema).min(1).max(6),
    objections: z.array(battlecardObjectionSchema).min(1).max(6),
    talkTracks: z.array(textSchema).min(1).max(6),
    counterMoves: counterMovesSchema,
    approvalStatus: z.literal("pending")
  })
  .strict();

export const targetAccountRequestSchema = z
  .object({
    type: z.literal("Target accounts"),
    title: textSchema,
    icp: textSchema,
    category: textSchema,
    geography: textSchema,
    competitorContext: textSchema,
    buyingTriggers: z.array(textSchema).min(1).max(8),
    exclusions: z.array(textSchema).max(8),
    limit: z.number().int().min(1).max(100),
    evidence: z.array(evidenceSchema).min(1).max(10),
    approvalStatus: z.literal("pending")
  })
  .strict();

export const agentActivityStepSchema = z
  .object({
    label: textSchema,
    source: textSchema,
    status: activityStatusSchema,
    evidence: textSchema,
    relatedTo: z
      .enum([
        "suggested competitor",
        "signal",
        "counter-move",
        "artifact",
        "approval",
        "target account request"
      ])
      .optional()
  })
  .strict();

export const agentStructuredOutputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("competitor_suggestion"),
      data: competitorSuggestionSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("signal_explanation"),
      data: signalExplanationSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("counter_move_plan"),
      data: counterMovePlanSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("battlecard_artifact"),
      data: battlecardArtifactSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("target_account_request"),
      data: targetAccountRequestSchema
    })
    .strict(),
  z
    .object({
      type: z.literal("agent_activity_step"),
      data: agentActivityStepSchema
    })
    .strict()
]);

export type ThreatType = z.infer<typeof threatTypeSchema>;
export type SuggestionPriority = z.infer<typeof suggestionPrioritySchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type SignalPriority = z.infer<typeof signalPrioritySchema>;
export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CounterMoves = z.infer<typeof counterMovesSchema>;
export type CompetitorSuggestion = z.infer<typeof competitorSuggestionSchema>;
export type SignalExplanation = z.infer<typeof signalExplanationSchema>;
export type CounterMoveStep = z.infer<typeof counterMoveStepSchema>;
export type CounterMovePlan = z.infer<typeof counterMovePlanSchema>;
export type BattlecardObjection = z.infer<typeof battlecardObjectionSchema>;
export type BattlecardArtifact = z.infer<typeof battlecardArtifactSchema>;
export type TargetAccountRequest = z.infer<typeof targetAccountRequestSchema>;
export type AgentActivityStep = z.infer<typeof agentActivityStepSchema>;
export type AgentStructuredOutput = z.infer<typeof agentStructuredOutputSchema>;

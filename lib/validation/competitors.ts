import { z } from "zod";

const threatTypeSchema = z.enum([
  "Direct",
  "Indirect",
  "Substitute",
  "Emerging",
  "Enterprise"
]);
const competitorPrioritySchema = z.enum(["High", "Medium", "Low"]);
const decisionSchema = z.enum(["approved", "rejected", "verified", "ignored", "snoozed"]);
const confidenceSchema = z.coerce
  .number()
  .int("Confidence must be a whole number.")
  .min(0, "Confidence must be at least 0.")
  .max(100, "Confidence cannot exceed 100.");

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export function normalizeDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

const domainSchema = z
  .string()
  .trim()
  .min(2, "Domain is required.")
  .max(240, "Domain is too long.")
  .transform(normalizeDomain)
  .refine((value) => value.length >= 2 && !/\s/.test(value), {
    message: "Enter a valid domain."
  });

export const competitorIdParamsSchema = z.object({
  id: z.string().uuid("Invalid competitor id.")
});

export const suggestedCompetitorIdParamsSchema = z.object({
  id: z.string().uuid("Invalid suggested competitor id.")
});

export const createCompetitorSchema = z
  .object({
    name: text("Name", 160),
    domain: domainSchema,
    threatType: threatTypeSchema.default("Direct"),
    trackingPriority: competitorPrioritySchema.default("Medium"),
    positioning: text("Positioning", 2000).default("Manually added competitor."),
    headcount: text("Headcount", 240).default("Pending enrichment"),
    hiring: text("Hiring", 500).default("Queued for hiring signal check"),
    funding: text("Funding", 500).default("Pending enrichment"),
    confidence: confidenceSchema.default(65)
  })
  .strict();

export const updateCompetitorSchema = z
  .object({
    name: text("Name", 160).optional(),
    domain: domainSchema.optional(),
    threatType: threatTypeSchema.optional(),
    trackingPriority: competitorPrioritySchema.optional(),
    positioning: text("Positioning", 2000).optional(),
    headcount: text("Headcount", 240).optional(),
    hiring: text("Hiring", 500).optional(),
    funding: text("Funding", 500).optional(),
    confidence: confidenceSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one competitor field."
  });

export const createSuggestedCompetitorSchema = z
  .object({
    value: z.string().trim().min(2, "Enter a competitor name or domain.").max(240)
  })
  .strict();

export const updateSuggestedCompetitorSchema = z
  .object({
    name: text("Name", 160).optional(),
    domain: domainSchema.optional(),
    description: text("Description", 2000).optional(),
    threatType: threatTypeSchema.optional(),
    confidence: confidenceSchema.optional(),
    priority: competitorPrioritySchema.optional(),
    evidence: z.array(text("Evidence", 500)).max(12).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one suggested competitor field."
  });

export const suggestedCompetitorDecisionSchema = z
  .object({
    decision: decisionSchema,
    reason: z.string().trim().max(500).optional()
  })
  .strict();

export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;
export type UpdateSuggestedCompetitorInput = z.infer<
  typeof updateSuggestedCompetitorSchema
>;

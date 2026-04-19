import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const domainSchema = nonEmptyString.transform((value) =>
  value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase()
);
const isoDateString = nonEmptyString.refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected an ISO-compatible date string"
});
const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const jobNameSchema = z.enum([
  "competitor.discovery",
  "company.enrichment",
  "jobs.monitoring",
  "person_movement.monitoring",
  "page.snapshot",
  "signal.scoring",
  "weekly.briefing"
]);

export const requestedBySchema = z.enum(["user", "system", "schedule"]);
export const providerSchema = z.enum(["crustdata", "web", "manual", "internal"]);

export const seedCompetitorSchema = z
  .object({
    name: nonEmptyString,
    domain: domainSchema.optional(),
    url: z.string().trim().url().optional()
  })
  .strict();

export const competitorDiscoveryPayloadSchema = z
  .object({
    jobType: z.literal("competitor.discovery"),
    workspaceId: nonEmptyString,
    userId: optionalNonEmptyString,
    productProfileId: optionalNonEmptyString,
    companyName: optionalNonEmptyString,
    companyDomain: domainSchema.optional(),
    productDescription: optionalNonEmptyString,
    icp: optionalNonEmptyString,
    category: optionalNonEmptyString,
    geography: optionalNonEmptyString,
    seedCompetitors: z.array(seedCompetitorSchema).default([]),
    limit: z.number().int().min(1).max(50).default(10),
    requestedBy: requestedBySchema.default("user"),
    forceRefresh: z.boolean().default(false),
    metadata: metadataSchema
  })
  .strict();

export const companyEnrichmentPayloadSchema = z
  .object({
    jobType: z.literal("company.enrichment"),
    workspaceId: nonEmptyString,
    competitorId: optionalNonEmptyString,
    companyName: optionalNonEmptyString,
    domain: domainSchema.optional(),
    provider: providerSchema.default("crustdata"),
    fields: z.array(nonEmptyString).default([]),
    forceRefresh: z.boolean().default(false),
    metadata: metadataSchema
  })
  .strict()
  .refine(
    (payload) => Boolean(payload.competitorId || payload.domain || payload.companyName),
    "Provide competitorId, domain, or companyName"
  );

export const jobsMonitoringPayloadSchema = z
  .object({
    jobType: z.literal("jobs.monitoring"),
    workspaceId: nonEmptyString,
    competitorId: nonEmptyString,
    companyName: nonEmptyString,
    companyDomain: domainSchema.optional(),
    query: optionalNonEmptyString,
    roleKeywords: z.array(nonEmptyString).default([]),
    locations: z.array(nonEmptyString).default([]),
    since: isoDateString.optional(),
    lookbackDays: z.number().int().min(1).max(180).default(14),
    baselineWindowDays: z.number().int().min(7).max(365).default(30),
    limit: z.number().int().min(1).max(500).default(100),
    provider: providerSchema.default("crustdata"),
    metadata: metadataSchema
  })
  .strict();

export const personMovementMonitoringPayloadSchema = z
  .object({
    jobType: z.literal("person_movement.monitoring"),
    workspaceId: nonEmptyString,
    competitorId: optionalNonEmptyString,
    companyName: nonEmptyString,
    companyDomain: domainSchema.optional(),
    roleKeywords: z.array(nonEmptyString).default([]),
    personIds: z.array(nonEmptyString).default([]),
    lookbackDays: z.number().int().min(1).max(365).default(30),
    enrichSelectedPeople: z.boolean().default(true),
    provider: providerSchema.default("crustdata"),
    metadata: metadataSchema
  })
  .strict();

export const pageSnapshotPayloadSchema = z
  .object({
    jobType: z.literal("page.snapshot"),
    workspaceId: nonEmptyString,
    competitorId: optionalNonEmptyString,
    url: z.string().trim().url(),
    pageType: z
      .enum(["homepage", "pricing", "changelog", "blog", "docs", "careers", "other"])
      .default("other"),
    previousSnapshotId: optionalNonEmptyString,
    fetchDepth: z.number().int().min(0).max(2).default(0),
    respectRobots: z.boolean().default(true),
    metadata: metadataSchema
  })
  .strict();

export const signalScoringPayloadSchema = z
  .object({
    jobType: z.literal("signal.scoring"),
    workspaceId: nonEmptyString,
    signalId: optionalNonEmptyString,
    candidateSignalIds: z.array(nonEmptyString).default([]),
    sourceKinds: z
      .array(z.enum(["jobs", "people", "company", "page", "manual"]))
      .default([]),
    recompute: z.boolean().default(false),
    metadata: metadataSchema
  })
  .strict()
  .refine(
    (payload) => Boolean(payload.signalId || payload.candidateSignalIds.length > 0),
    "Provide signalId or candidateSignalIds"
  );

export const weeklyBriefingPayloadSchema = z
  .object({
    jobType: z.literal("weekly.briefing"),
    workspaceId: nonEmptyString,
    recipientUserId: optionalNonEmptyString,
    weekStartsOn: isoDateString.optional(),
    signalLookbackDays: z.number().int().min(1).max(31).default(7),
    maxSignals: z.number().int().min(1).max(50).default(10),
    deliveryMode: z.enum(["in_app", "email", "none"]).default("in_app"),
    metadata: metadataSchema
  })
  .strict();

export const jobPayloadSchema = z.discriminatedUnion("jobType", [
  competitorDiscoveryPayloadSchema,
  companyEnrichmentPayloadSchema,
  jobsMonitoringPayloadSchema,
  personMovementMonitoringPayloadSchema,
  pageSnapshotPayloadSchema,
  signalScoringPayloadSchema,
  weeklyBriefingPayloadSchema
]);

export const jobPayloadSchemas = {
  "competitor.discovery": competitorDiscoveryPayloadSchema,
  "company.enrichment": companyEnrichmentPayloadSchema,
  "jobs.monitoring": jobsMonitoringPayloadSchema,
  "person_movement.monitoring": personMovementMonitoringPayloadSchema,
  "page.snapshot": pageSnapshotPayloadSchema,
  "signal.scoring": signalScoringPayloadSchema,
  "weekly.briefing": weeklyBriefingPayloadSchema
} as const;

export type JobName = z.infer<typeof jobNameSchema>;
export type CompetitorDiscoveryPayload = z.infer<typeof competitorDiscoveryPayloadSchema>;
export type CompanyEnrichmentPayload = z.infer<typeof companyEnrichmentPayloadSchema>;
export type JobsMonitoringPayload = z.infer<typeof jobsMonitoringPayloadSchema>;
export type PersonMovementMonitoringPayload = z.infer<
  typeof personMovementMonitoringPayloadSchema
>;
export type PageSnapshotPayload = z.infer<typeof pageSnapshotPayloadSchema>;
export type SignalScoringPayload = z.infer<typeof signalScoringPayloadSchema>;
export type WeeklyBriefingPayload = z.infer<typeof weeklyBriefingPayloadSchema>;
export type JobPayload = z.infer<typeof jobPayloadSchema>;

export function parseJobPayload(payload: unknown): JobPayload {
  return jobPayloadSchema.parse(payload);
}

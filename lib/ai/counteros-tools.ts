import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { CrustdataError } from "@/lib/crustdata/client";
import {
  discoverCompanies,
  enrichCompetitorCompany,
  normalizeDomain as normalizeCrustdataDomain,
  resolveCompanyIdentity
} from "@/lib/crustdata/intelligence";
import {
  createArtifact,
  createSuggestedCompetitor,
  createTrackedPage,
  decideSuggestedCompetitor,
  getTrackedPage,
  getTrackedPageByUrl,
  getWorkspaceAgentContext,
  recordAgentActivity,
  updateCompetitor
} from "@/lib/db/queries";
import { snapshotTrackedPage } from "@/lib/pages/snapshot";
import type {
  AgentActivity,
  AgentToolOutput,
  CompetitorProfile,
  PageSnapshot,
  Signal,
  SuggestedCompetitor,
  TrackedPage
} from "@/lib/types";
import { normalizeDomain } from "@/lib/validation/competitors";
import { pageTypeSchema } from "@/lib/validation/pages";

const threatTypeSchema = z.enum([
  "Direct",
  "Indirect",
  "Substitute",
  "Emerging",
  "Enterprise"
]);
const suggestionPrioritySchema = z.enum(["High", "Medium", "Low"]);
const artifactTypeSchema = z.enum(["Battlecard", "Target accounts", "Positioning memo"]);

export function createCounterOSTools(workspaceId: string) {
  return {
    approveSuggestion: tool({
      title: "Approve suggestion",
      description:
        "Approve one or more pending competitor suggestions only when the founder explicitly asks. This creates approved competitors and attempts provider enrichment.",
      inputSchema: z.object({
        target: z
          .string()
          .min(1)
          .describe("Suggestion id, company name, domain, or 'all' for every pending suggestion."),
        reason: z.string().min(1).optional().describe("Short founder-facing reason for the approval.")
      }),
      execute: async ({ target, reason }) =>
        decideSuggestionsFromTool({
          workspaceId,
          target,
          decision: "approved",
          reason: reason ?? "Approved from agent chat."
        })
    }),
    rejectSuggestion: tool({
      title: "Reject suggestion",
      description:
        "Reject one or more pending competitor suggestions only when the founder explicitly asks.",
      inputSchema: z.object({
        target: z
          .string()
          .min(1)
          .describe("Suggestion id, company name, domain, or 'all' for every pending suggestion."),
        reason: z.string().min(1).optional().describe("Short founder-facing reason for the rejection.")
      }),
      execute: async ({ target, reason }) =>
        decideSuggestionsFromTool({
          workspaceId,
          target,
          decision: "rejected",
          reason: reason ?? "Rejected from agent chat."
        })
    }),
    discoverCompetitors: tool({
      title: "Discover competitors",
      description:
        "Search the configured provider for competitor companies and save new results into the pending suggestion queue.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe("Focused provider search query, usually a company, category, or market phrase."),
        limit: z.number().int().min(1).max(10).default(6)
      }),
      execute: async ({ query, limit }) => discoverCompetitorsFromProvider(workspaceId, query, limit)
    }),
    saveCompetitorSuggestion: tool({
      title: "Save competitor suggestion",
      description:
        "Save a specific competitor suggestion named by the founder. Use this when the founder says to add/save a company, not for broad discovery.",
      inputSchema: z.object({
        value: z
          .string()
          .min(2)
          .describe("Company name, website, or domain the founder explicitly asked to add."),
        name: z.string().min(1).optional(),
        domain: z.string().min(2).optional(),
        description: z.string().min(1).optional(),
        threatType: threatTypeSchema.default("Direct"),
        confidence: z.number().int().min(0).max(100).default(65),
        priority: suggestionPrioritySchema.default("Medium"),
        evidence: z.array(z.string().min(1)).max(8).default([])
      }),
      execute: async (input) => saveCompetitorSuggestionFromTool(workspaceId, input)
    }),
    saveArtifact: tool({
      title: "Save artifact",
      description:
        "Save a battlecard, target-account request, or positioning memo when the founder explicitly asks the agent to create or save one.",
      inputSchema: z.object({
        type: artifactTypeSchema,
        title: z.string().min(1).max(180),
        summary: z.string().min(1).max(1200),
        bullets: z.array(z.string().min(1).max(500)).min(1).max(10)
      }),
      execute: async (input) => saveArtifactFromTool(workspaceId, input)
    }),
    trackPage: tool({
      title: "Track page",
      description:
        "Add a URL to tracked pages. Use snapshotNow when the founder asks to fetch, check, capture, or snapshot it immediately.",
      inputSchema: z.object({
        url: z.string().url(),
        pageType: pageTypeSchema.default("other"),
        competitor: z
          .string()
          .min(1)
          .optional()
          .describe("Optional competitor name or domain to attach the page to."),
        snapshotNow: z.boolean().default(false)
      }),
      execute: async (input) => trackPageFromTool(workspaceId, input)
    }),
    snapshotTrackedPage: tool({
      title: "Snapshot tracked page",
      description:
        "Fetch and diff an already-tracked page. Use a tracked page id when available, otherwise use an exact tracked URL.",
      inputSchema: z
        .object({
          trackedPageId: z.string().uuid().optional(),
          url: z.string().url().optional()
        })
        .refine((value) => value.trackedPageId || value.url, {
          message: "Provide a trackedPageId or url."
        }),
      execute: async (input) => snapshotPageFromTool(workspaceId, input)
    })
  };
}

export type CounterOSTools = ReturnType<typeof createCounterOSTools>;

async function decideSuggestionsFromTool(input: {
  workspaceId: string;
  target: string;
  decision: "approved" | "rejected";
  reason: string;
}): Promise<AgentToolOutput> {
  const targets = resolveSuggestionTargets(input.workspaceId, input.target);

  if (targets.length === 0) {
    const activity = recordToolActivity(input.workspaceId, {
      label: input.decision === "approved" ? "Approve suggestion" : "Reject suggestion",
      source: "SQLite",
      status: "Needs approval",
      evidence: `No pending suggestion matched "${input.target}".`
    });

    return {
      ok: false,
      code: "suggestion_not_found",
      summary: `No pending suggestion matched "${input.target}".`,
      activities: [activity]
    };
  }

  const activities: AgentActivity[] = [];
  const suggestionUpdates: SuggestedCompetitor[] = [];
  const approvedCompetitors: CompetitorProfile[] = [];

  for (const suggestion of targets) {
    const result = decideSuggestedCompetitor({
      workspaceId: input.workspaceId,
      suggestionId: suggestion.id,
      decision: input.decision,
      reason: input.reason
    });

    if (!result?.suggestion) {
      activities.push(
        recordToolActivity(input.workspaceId, {
          label: input.decision === "approved" ? "Approve suggestion" : "Reject suggestion",
          source: "SQLite",
          status: "Needs approval",
          evidence: `${suggestion.name} could not be updated.`
        })
      );
      continue;
    }

    suggestionUpdates.push(result.suggestion);
    activities.push(
      recordToolActivity(input.workspaceId, {
        label: input.decision === "approved" ? "Approve suggestion" : "Reject suggestion",
        source: "SQLite",
        status: "Done",
        evidence: `${result.suggestion.name} was marked ${input.decision}.`
      })
    );

    if (input.decision === "approved" && result.competitor) {
      const { competitor, activity } = await enrichApprovedCompetitor(
        input.workspaceId,
        result.competitor
      );
      approvedCompetitors.push(competitor);
      activities.push(activity);
    }
  }

  const changedNames = suggestionUpdates.map((suggestion) => suggestion.name).join(", ");

  return {
    ok: suggestionUpdates.length > 0,
    summary:
      suggestionUpdates.length > 0
        ? `${changedNames} ${suggestionUpdates.length === 1 ? "was" : "were"} marked ${input.decision}.`
        : "No suggestions were changed.",
    suggestionUpdates,
    approvedCompetitors,
    activities
  };
}

async function enrichApprovedCompetitor(
  workspaceId: string,
  competitor: CompetitorProfile
): Promise<{ competitor: CompetitorProfile; activity: AgentActivity }> {
  const enrichment = await enrichCompetitorCompany({ competitor, workspaceId });
  const updated = updateCompetitor({
    workspaceId,
    competitorId: competitor.id,
    updates: {
      intelligenceStatus: enrichment.intelligenceStatus,
      crustdataCompanyId: enrichment.crustdataCompanyId,
      crustdataMatchConfidence: enrichment.crustdataMatchConfidence,
      crustdataProfile: enrichment.crustdataProfile,
      enrichmentError: enrichment.enrichmentError,
      enrichedAt: enrichment.enrichedAt,
      ...(enrichment.headcount ? { headcount: enrichment.headcount } : {}),
      ...(enrichment.funding ? { funding: enrichment.funding } : {}),
      ...(enrichment.hiring ? { hiring: enrichment.hiring } : {})
    }
  });
  const finalCompetitor = updated ?? competitor;

  return {
    competitor: finalCompetitor,
    activity: recordToolActivity(workspaceId, {
      label: "Enrich approved competitor",
      source: "Crustdata",
      status: enrichment.intelligenceStatus === "failed" ? "Needs approval" : "Done",
      evidence:
        enrichment.enrichmentError ??
        `${finalCompetitor.name} enrichment finished with ${finalCompetitor.intelligenceStatus}.`
    })
  };
}

async function discoverCompetitorsFromProvider(
  workspaceId: string,
  query: string,
  limit: number
): Promise<AgentToolOutput> {
  if (!process.env.CRUSTDATA_API_KEY) {
    const activity = recordToolActivity(workspaceId, {
      label: "Discover competitors",
      source: "Crustdata",
      status: "Needs approval",
      evidence: "CRUSTDATA_API_KEY is not configured, so provider discovery could not run."
    });

    return {
      ok: false,
      code: "provider_key_missing",
      summary: "Provider discovery could not run because CRUSTDATA_API_KEY is missing.",
      activities: [activity]
    };
  }

  try {
    const companies = await discoverCompanies({ query, limit, workspaceId });
    const suggestedCompetitors = persistDiscoveredCompanies(workspaceId, companies);
    const activity = recordToolActivity(workspaceId, {
      label: "Discover competitors",
      source: "Crustdata",
      status: "Done",
      evidence: `Crustdata returned ${companies.length} companies; ${suggestedCompetitors.length} new suggestions were saved.`
    });

    return {
      ok: true,
      summary: `${suggestedCompetitors.length} new competitor suggestions were saved from provider discovery.`,
      suggestedCompetitors,
      activities: [activity]
    };
  } catch (error) {
    const detail = formatProviderError(error);
    const activity = recordToolActivity(workspaceId, {
      label: "Discover competitors",
      source: "Crustdata",
      status: "Needs approval",
      evidence: detail
    });

    return {
      ok: false,
      code: "provider_discovery_failed",
      summary: `Provider discovery did not complete: ${detail}`,
      activities: [activity]
    };
  }
}

async function saveCompetitorSuggestionFromTool(
  workspaceId: string,
  input: {
    value: string;
    name?: string;
    domain?: string;
    description?: string;
    threatType: SuggestedCompetitor["threatType"];
    confidence: number;
    priority: SuggestedCompetitor["priority"];
    evidence: string[];
  }
): Promise<AgentToolOutput> {
  const identity = await resolveCompanyIdentity({ value: input.domain ?? input.value, workspaceId });
  const cleanDomain = normalizeDomain(identity.matchedDomain ?? input.domain ?? input.value);

  if (!cleanDomain.includes(".")) {
    const activity = recordToolActivity(workspaceId, {
      label: "Save competitor suggestion",
      source: "Agent",
      status: "Needs approval",
      evidence: `Could not infer a valid domain for "${input.value}".`
    });

    return {
      ok: false,
      code: "domain_required",
      summary: `I need a website or domain before I can save "${input.value}" as a competitor suggestion.`,
      activities: [activity]
    };
  }

  const context = getWorkspaceAgentContext(workspaceId);
  const duplicate = [...context.competitors, ...context.suggestedCompetitors].find(
    (competitor) =>
      normalizeDomain(competitor.domain) === cleanDomain ||
      normalizeForMatch(competitor.name) === normalizeForMatch(input.name ?? input.value)
  );

  if (duplicate) {
    const activity = recordToolActivity(workspaceId, {
      label: "Save competitor suggestion",
      source: "SQLite",
      status: "Done",
      evidence: `${duplicate.name} is already in the workspace.`
    });

    return {
      ok: true,
      code: "already_exists",
      summary: `${duplicate.name} is already in the workspace, so I did not create a duplicate.`,
      activities: [activity]
    };
  }

  const displayName =
    input.name?.trim() ||
    identity.matchedName ||
    cleanDomain
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const suggestion = createSuggestedCompetitor({
    workspaceId,
    name: displayName,
    domain: cleanDomain,
    description:
      input.description ??
      (identity.intelligenceStatus === "resolved"
        ? "Resolved by Crustdata Identify and waiting for founder approval."
        : "Saved by the agent and waiting for founder approval."),
    threatType: input.threatType,
    confidence: input.confidence,
    priority: input.priority,
    evidence:
      input.evidence.length > 0
        ? input.evidence
        : identity.evidence.length > 0
          ? identity.evidence
          : ["Explicitly requested by the founder in agent chat."],
    intelligenceStatus: identity.intelligenceStatus,
    crustdataCompanyId: identity.crustdataCompanyId,
    crustdataMatchConfidence: identity.crustdataMatchConfidence,
    identifyError: identity.identifyError,
    identifiedAt: identity.identifiedAt
  });
  const activity = recordToolActivity(workspaceId, {
    label: "Save competitor suggestion",
    source: "SQLite",
    status: "Done",
    evidence: `${suggestion.name} was added to the pending suggestion queue.`
  });

  return {
    ok: true,
    summary: `${suggestion.name} was saved as a pending competitor suggestion.`,
    suggestedCompetitors: [suggestion],
    activities: [activity]
  };
}

async function saveArtifactFromTool(
  workspaceId: string,
  input: {
    type: "Battlecard" | "Target accounts" | "Positioning memo";
    title: string;
    summary: string;
    bullets: string[];
  }
): Promise<AgentToolOutput> {
  const artifact = createArtifact({ workspaceId, ...input });
  const activity = recordToolActivity(workspaceId, {
    label: "Save artifact",
    source: "SQLite",
    status: "Done",
    evidence: `${artifact.title} was saved as a ${artifact.type}.`
  });

  return {
    ok: true,
    summary: `${artifact.title} was saved as a ${artifact.type}.`,
    artifact,
    activities: [activity]
  };
}

async function trackPageFromTool(
  workspaceId: string,
  input: {
    url: string;
    pageType: TrackedPage["pageType"];
    competitor?: string;
    snapshotNow: boolean;
  }
): Promise<AgentToolOutput> {
  const clean = cleanUrl(input.url);

  if (!clean) {
    return {
      ok: false,
      code: "invalid_url",
      summary: "That URL could not be normalized into a trackable page."
    };
  }

  const existing = getTrackedPageByUrl(workspaceId, clean);
  const trackedPage =
    existing ??
    createTrackedPage({
      workspaceId,
      competitorId: inferCompetitorIdForUrl(workspaceId, clean, input.competitor),
      url: clean,
      pageType: input.pageType
    });
  const activities = [
    recordToolActivity(workspaceId, {
      label: existing ? "Use tracked page" : "Track page",
      source: "SQLite",
      status: "Done",
      evidence: existing
        ? `${trackedPage.url} was already tracked.`
        : `${trackedPage.url} was added as a ${trackedPage.pageType} page.`
    })
  ];
  const snapshots: PageSnapshot[] = [];
  const signals: Signal[] = [];

  if (input.snapshotNow) {
    const snapshotResult = await snapshotTrackedPageSafely(workspaceId, trackedPage);
    activities.push(snapshotResult.activity);
    if (snapshotResult.snapshot) {
      snapshots.push(snapshotResult.snapshot);
    }
    if (snapshotResult.signal) {
      signals.push(snapshotResult.signal);
    }

    return {
      ok: snapshotResult.ok,
      code: snapshotResult.ok ? undefined : "snapshot_failed",
      summary: snapshotResult.ok
        ? `${trackedPage.url} is tracked and a fresh snapshot was saved.`
        : `${trackedPage.url} is tracked, but the snapshot failed: ${snapshotResult.summary}`,
      trackedPages: [trackedPage],
      snapshots,
      signals,
      activities
    };
  }

  return {
    ok: true,
    summary: `${trackedPage.url} is now tracked.`,
    trackedPages: [trackedPage],
    activities
  };
}

async function snapshotPageFromTool(
  workspaceId: string,
  input: {
    trackedPageId?: string;
    url?: string;
  }
): Promise<AgentToolOutput> {
  const trackedPage = input.trackedPageId
    ? getTrackedPage(workspaceId, input.trackedPageId)
    : input.url
      ? getTrackedPageByUrl(workspaceId, cleanUrl(input.url))
      : null;

  if (!trackedPage) {
    const activity = recordToolActivity(workspaceId, {
      label: "Snapshot tracked page",
      source: "Page fetcher",
      status: "Needs approval",
      evidence: "The requested tracked page was not found."
    });

    return {
      ok: false,
      code: "tracked_page_not_found",
      summary: "The requested tracked page was not found.",
      activities: [activity]
    };
  }

  const snapshotResult = await snapshotTrackedPageSafely(workspaceId, trackedPage);

  return {
    ok: snapshotResult.ok,
    code: snapshotResult.ok ? undefined : "snapshot_failed",
    summary: snapshotResult.summary,
    snapshots: snapshotResult.snapshot ? [snapshotResult.snapshot] : [],
    signals: snapshotResult.signal ? [snapshotResult.signal] : [],
    activities: [snapshotResult.activity]
  };
}

async function snapshotTrackedPageSafely(workspaceId: string, trackedPage: TrackedPage) {
  try {
    const { snapshot, signal } = await snapshotTrackedPage({
      workspaceId,
      trackedPageId: trackedPage.id
    });

    return {
      ok: true,
      summary: signal
        ? `Snapshot saved for ${trackedPage.url}; a page-change signal was created.`
        : `Snapshot saved for ${trackedPage.url}.`,
      snapshot,
      signal,
      activity: recordToolActivity(workspaceId, {
        label: "Snapshot tracked page",
        source: "Page fetcher",
        status: "Done",
        evidence: signal
          ? `Snapshot saved for ${trackedPage.url}; a page-change signal was created.`
          : `Snapshot saved for ${trackedPage.url}.`
      })
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Unknown page snapshot error.";

    return {
      ok: false,
      summary,
      snapshot: null,
      signal: null,
      activity: recordToolActivity(workspaceId, {
        label: "Snapshot tracked page",
        source: "Page fetcher",
        status: "Needs approval",
        evidence: summary
      })
    };
  }
}

function persistDiscoveredCompanies(
  workspaceId: string,
  companies: Awaited<ReturnType<typeof discoverCompanies>>
) {
  const context = getWorkspaceAgentContext(workspaceId);
  const seenDomains = new Set(
    [...context.competitors, ...context.suggestedCompetitors].map((competitor) =>
      normalizeDomain(competitor.domain)
    )
  );
  const seenNames = new Set(
    [...context.competitors, ...context.suggestedCompetitors].map((competitor) =>
      normalizeForMatch(competitor.name)
    )
  );
  const created: SuggestedCompetitor[] = [];

  for (const company of companies) {
    const domain =
      company.basic_info?.primary_domain ?? normalizeCrustdataDomain(company.basic_info?.website);
    const name = company.basic_info?.name ?? domain;

    if (!domain || seenDomains.has(normalizeDomain(domain)) || seenNames.has(normalizeForMatch(name))) {
      continue;
    }

    seenDomains.add(normalizeDomain(domain));
    seenNames.add(normalizeForMatch(name));
    created.push(
      createSuggestedCompetitor({
        workspaceId,
        name,
        domain: normalizeDomain(domain),
        description: "Discovered by Crustdata Company Search.",
        threatType: "Emerging",
        confidence: 70,
        priority: "Medium",
        evidence: [
          "Returned by Crustdata Company Search for the founder's discovery query.",
          company.basic_info?.employee_count_range
            ? `Employee range: ${company.basic_info.employee_count_range}.`
            : "Company profile returned without employee range."
        ],
        intelligenceStatus: "resolved",
        crustdataCompanyId: company.crustdata_company_id ?? null,
        identifiedAt: new Date().toISOString()
      })
    );
  }

  return created;
}

function resolveSuggestionTargets(workspaceId: string, target: string) {
  const normalizedTarget = normalizeForMatch(target);
  const pending = getWorkspaceAgentContext(workspaceId).suggestedCompetitors.filter(
    (suggestion) => suggestion.status === "pending"
  );

  if (/\b(all|every|everything)\b/.test(normalizedTarget)) {
    return pending;
  }

  return pending.filter((suggestion) => {
    const name = normalizeForMatch(suggestion.name);
    const domain = normalizeForMatch(suggestion.domain);
    const domainRoot = normalizeForMatch(suggestion.domain.split(".")[0] ?? "");

    return (
      suggestion.id === target ||
      (name.length > 2 && normalizedTarget.includes(name)) ||
      (domain.length > 2 && normalizedTarget.includes(domain)) ||
      (domainRoot.length > 2 && normalizedTarget.includes(domainRoot))
    );
  });
}

function inferCompetitorIdForUrl(workspaceId: string, url: string, target?: string) {
  const context = getWorkspaceAgentContext(workspaceId);
  const normalizedUrl = normalizeDomain(url);
  const normalizedTarget = target ? normalizeForMatch(target) : "";
  const competitor = context.competitors.find((item) => {
    const domain = normalizeDomain(item.domain);

    return (
      normalizedUrl.includes(domain) ||
      (normalizedTarget &&
        (normalizeForMatch(item.name).includes(normalizedTarget) ||
          normalizeForMatch(item.domain).includes(normalizedTarget)))
    );
  });

  return competitor?.id ?? null;
}

function recordToolActivity(
  workspaceId: string,
  input: {
    label: string;
    source: string;
    status: AgentActivity["status"];
    evidence: string;
  }
) {
  return recordAgentActivity({ workspaceId, ...input });
}

function formatProviderError(error: unknown) {
  if (error instanceof CrustdataError) {
    return `${error.message} (${error.endpoint}, status ${error.status ?? "unknown"}).`;
  }

  return error instanceof Error ? error.message : "Unknown Crustdata provider error.";
}

function cleanUrl(value: string) {
  const trimmed = value.trim().replace(/[.,;!?]+$/g, "");

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/^www\./g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

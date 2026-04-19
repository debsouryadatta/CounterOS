import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    ...timestamps
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("workspaces_user_idx").on(table.userId)
  })
);

export const productProfiles = sqliteTable(
  "product_profiles",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icp: text("icp").notNull(),
    category: text("category").notNull(),
    geography: text("geography").notNull(),
    wedge: text("wedge").notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("product_profiles_workspace_idx").on(table.workspaceId)
  })
);

export const suggestedCompetitors = sqliteTable(
  "suggested_competitors",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    description: text("description").notNull(),
    threatType: text("threat_type").notNull(),
    confidence: integer("confidence").notNull(),
    priority: text("priority").notNull(),
    evidenceJson: text("evidence_json").notNull(),
    status: text("status").notNull().default("pending"),
    intelligenceStatus: text("intelligence_status").notNull().default("unresolved"),
    crustdataCompanyId: text("crustdata_company_id"),
    crustdataMatchConfidence: integer("crustdata_match_confidence"),
    identifyError: text("identify_error"),
    identifiedAt: text("identified_at"),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("suggested_competitors_workspace_idx").on(table.workspaceId),
    domainWorkspaceIdx: index("suggested_competitors_domain_workspace_idx").on(
      table.domain,
      table.workspaceId
    ),
    crustdataCompanyIdx: index("suggested_competitors_crustdata_company_idx").on(
      table.crustdataCompanyId
    )
  })
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceSuggestionId: text("source_suggestion_id").references(
      () => suggestedCompetitors.id,
      { onDelete: "set null" }
    ),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    threatType: text("threat_type").notNull(),
    trackingPriority: text("tracking_priority").notNull(),
    positioning: text("positioning").notNull(),
    headcount: text("headcount").notNull(),
    hiring: text("hiring").notNull(),
    funding: text("funding").notNull(),
    confidence: integer("confidence").notNull(),
    intelligenceStatus: text("intelligence_status").notNull().default("unresolved"),
    crustdataCompanyId: text("crustdata_company_id"),
    crustdataMatchConfidence: integer("crustdata_match_confidence"),
    crustdataProfileJson: text("crustdata_profile_json"),
    enrichmentError: text("enrichment_error"),
    enrichedAt: text("enriched_at"),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("competitors_workspace_idx").on(table.workspaceId),
    crustdataCompanyIdx: index("competitors_crustdata_company_idx").on(
      table.crustdataCompanyId
    ),
    uniqueDomainPerWorkspace: uniqueIndex("competitors_domain_workspace_idx").on(
      table.domain,
      table.workspaceId
    )
  })
);

export const approvalDecisions = sqliteTable(
  "approval_decisions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => suggestedCompetitors.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    workspaceIdx: index("approval_decisions_workspace_idx").on(table.workspaceId)
  })
);

export const signals = sqliteTable(
  "signals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    competitor: text("competitor").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    impactScore: integer("impact_score").notNull(),
    priority: text("priority").notNull(),
    detectedAt: text("detected_at").notNull(),
    meaning: text("meaning").notNull(),
    recommendedMove: text("recommended_move").notNull(),
    counterMovesJson: text("counter_moves_json").notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("signals_workspace_idx").on(table.workspaceId)
  })
);

export const evidenceSources = sqliteTable(
  "evidence_sources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    signalId: text("signal_id").references(() => signals.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    detail: text("detail").notNull(),
    freshness: text("freshness").notNull(),
    url: text("url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    workspaceIdx: index("evidence_sources_workspace_idx").on(table.workspaceId),
    signalIdx: index("evidence_sources_signal_idx").on(table.signalId)
  })
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    bulletsJson: text("bullets_json").notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("artifacts_workspace_idx").on(table.workspaceId)
  })
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("chats_workspace_idx").on(table.workspaceId)
  })
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    chatIdx: index("messages_chat_idx").on(table.chatId)
  })
);

export const agentActivities = sqliteTable(
  "agent_activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    evidence: text("evidence").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    workspaceIdx: index("agent_activities_workspace_idx").on(table.workspaceId)
  })
);

export const apiCacheEntries = sqliteTable(
  "api_cache_entries",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade"
    }),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    cacheKey: text("cache_key").notNull(),
    responseJson: text("response_json").notNull(),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    cacheKeyIdx: uniqueIndex("api_cache_entries_provider_key_idx").on(
      table.provider,
      table.cacheKey
    )
  })
);

export const trackedPages = sqliteTable(
  "tracked_pages",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    competitorId: text("competitor_id").references(() => competitors.id, {
      onDelete: "set null"
    }),
    url: text("url").notNull(),
    pageType: text("page_type").notNull().default("other"),
    status: text("status").notNull().default("active"),
    lastSnapshotAt: text("last_snapshot_at"),
    lastError: text("last_error"),
    ...timestamps
  },
  (table) => ({
    workspaceIdx: index("tracked_pages_workspace_idx").on(table.workspaceId),
    competitorIdx: index("tracked_pages_competitor_idx").on(table.competitorId),
    uniquePagePerWorkspace: uniqueIndex("tracked_pages_url_workspace_idx").on(
      table.url,
      table.workspaceId
    )
  })
);

export const pageSnapshots = sqliteTable(
  "page_snapshots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    trackedPageId: text("tracked_page_id")
      .notNull()
      .references(() => trackedPages.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    extractedText: text("extracted_text").notNull(),
    textHash: text("text_hash").notNull(),
    diffSummary: text("diff_summary"),
    fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    workspaceIdx: index("page_snapshots_workspace_idx").on(table.workspaceId),
    trackedPageIdx: index("page_snapshots_tracked_page_idx").on(table.trackedPageId),
    hashIdx: index("page_snapshots_text_hash_idx").on(table.textHash)
  })
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type SuggestedCompetitorRow = typeof suggestedCompetitors.$inferSelect;
export type CompetitorRow = typeof competitors.$inferSelect;
export type TrackedPageRow = typeof trackedPages.$inferSelect;
export type PageSnapshotRow = typeof pageSnapshots.$inferSelect;

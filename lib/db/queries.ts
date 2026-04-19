import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type {
  AgentActivity,
  Artifact,
  CompetitorProfile,
  DashboardData,
  Evidence,
  ProductProfile,
  Signal,
  SuggestedCompetitor
} from "@/lib/types";
import { db } from "./index";
import {
  agentActivities,
  approvalDecisions,
  artifacts,
  chats,
  competitors,
  evidenceSources,
  messages,
  productProfiles,
  signals,
  suggestedCompetitors,
  users,
  workspaces
} from "./schema";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function findUserByEmail(email: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
    .get();
}

export function findUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).limit(1).get();
}

export function createUser(input: {
  email: string;
  name?: string | null;
  passwordHash: string;
}) {
  const userId = randomUUID();
  const user = {
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name?.trim() || null,
    passwordHash: input.passwordHash
  };

  db.insert(users).values(user).run();

  const createdUser = findUserById(userId);

  if (!createdUser) {
    throw new Error("Failed to create user");
  }

  return createdUser;
}

export function getDefaultWorkspace(userId: string) {
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1)
    .get();
}

export function getDashboardData(userId: string): DashboardData {
  const workspace = getDefaultWorkspace(userId);

  if (!workspace) {
    throw new Error("No workspace found for user");
  }

  const profile = db
    .select()
    .from(productProfiles)
    .where(eq(productProfiles.workspaceId, workspace.id))
    .limit(1)
    .get();

  if (!profile) {
    throw new Error("No product profile found for workspace");
  }

  const suggestionRows = db
    .select()
    .from(suggestedCompetitors)
    .where(eq(suggestedCompetitors.workspaceId, workspace.id))
    .orderBy(desc(suggestedCompetitors.createdAt))
    .all();

  const competitorRows = db
    .select()
    .from(competitors)
    .where(eq(competitors.workspaceId, workspace.id))
    .orderBy(desc(competitors.createdAt))
    .all();

  const signalRows = db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspace.id))
    .orderBy(desc(signals.impactScore))
    .all();

  const signalData = signalRows.map(mapSignal);

  const artifactRows = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.workspaceId, workspace.id))
    .orderBy(desc(artifacts.createdAt))
    .all();

  const activityRows = db
    .select()
    .from(agentActivities)
    .where(eq(agentActivities.workspaceId, workspace.id))
    .orderBy(asc(agentActivities.createdAt))
    .all();

  const chat = db
    .select()
    .from(chats)
    .where(eq(chats.workspaceId, workspace.id))
    .orderBy(asc(chats.createdAt))
    .limit(1)
    .get();

  const messageRows = chat
    ? db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(asc(messages.createdAt))
        .all()
    : [];

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name
    },
    productProfile: mapProductProfile(profile),
    suggestedCompetitors: suggestionRows.map(mapSuggestion),
    approvedCompetitors: competitorRows.map(mapCompetitor),
    signals: signalData,
    artifacts: artifactRows.map(mapArtifact),
    agentActivities: activityRows.map((activity): AgentActivity => ({
      id: activity.id,
      label: activity.label,
      source: activity.source,
      status: activity.status as AgentActivity["status"],
      evidence: activity.evidence
    })),
    messages: messageRows.map((message) => ({
      id: message.id,
      role: message.role as "agent" | "user",
      text: message.content
    }))
  };
}

export function getProductProfile(workspaceId: string): ProductProfile | null {
  const profile = db
    .select()
    .from(productProfiles)
    .where(eq(productProfiles.workspaceId, workspaceId))
    .limit(1)
    .get();

  return profile ? mapProductProfile(profile) : null;
}

export function updateProductProfile(input: {
  workspaceId: string;
  updates: Partial<ProductProfile>;
}): ProductProfile | null {
  const profile = db
    .select()
    .from(productProfiles)
    .where(eq(productProfiles.workspaceId, input.workspaceId))
    .limit(1)
    .get();

  if (!profile) {
    return null;
  }

  db.update(productProfiles)
    .set({
      ...input.updates,
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(productProfiles.id, profile.id),
        eq(productProfiles.workspaceId, input.workspaceId)
      )
    )
    .run();

  return getProductProfile(input.workspaceId);
}

export function listCompetitors(workspaceId: string): CompetitorProfile[] {
  return db
    .select()
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))
    .orderBy(desc(competitors.createdAt))
    .all()
    .map(mapCompetitor);
}

export function getCompetitor(
  workspaceId: string,
  competitorId: string
): CompetitorProfile | null {
  const competitor = db
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.id, competitorId),
        eq(competitors.workspaceId, workspaceId)
      )
    )
    .limit(1)
    .get();

  return competitor ? mapCompetitor(competitor) : null;
}

export function getCompetitorByDomain(
  workspaceId: string,
  domain: string
): CompetitorProfile | null {
  const competitor = db
    .select()
    .from(competitors)
    .where(and(eq(competitors.workspaceId, workspaceId), eq(competitors.domain, domain)))
    .limit(1)
    .get();

  return competitor ? mapCompetitor(competitor) : null;
}

export function createCompetitor(input: {
  workspaceId: string;
  competitor: Omit<CompetitorProfile, "id">;
}): CompetitorProfile {
  const competitorId = randomUUID();

  db.insert(competitors).values({
    id: competitorId,
    workspaceId: input.workspaceId,
    ...input.competitor
  }).run();

  const created = getCompetitor(input.workspaceId, competitorId);

  if (!created) {
    throw new Error("Failed to create competitor");
  }

  return created;
}

export function updateCompetitor(input: {
  workspaceId: string;
  competitorId: string;
  updates: Partial<Omit<CompetitorProfile, "id">>;
}): CompetitorProfile | null {
  const existing = getCompetitor(input.workspaceId, input.competitorId);

  if (!existing) {
    return null;
  }

  db.update(competitors)
    .set({
      ...input.updates,
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(competitors.id, input.competitorId),
        eq(competitors.workspaceId, input.workspaceId)
      )
    )
    .run();

  return getCompetitor(input.workspaceId, input.competitorId);
}

export function deleteCompetitor(workspaceId: string, competitorId: string) {
  const existing = getCompetitor(workspaceId, competitorId);

  if (!existing) {
    return false;
  }

  db.delete(competitors)
    .where(and(eq(competitors.id, competitorId), eq(competitors.workspaceId, workspaceId)))
    .run();

  return true;
}

export function listSuggestedCompetitors(workspaceId: string): SuggestedCompetitor[] {
  return db
    .select()
    .from(suggestedCompetitors)
    .where(eq(suggestedCompetitors.workspaceId, workspaceId))
    .orderBy(desc(suggestedCompetitors.createdAt))
    .all()
    .map(mapSuggestion);
}

export function getSuggestedCompetitor(
  workspaceId: string,
  suggestionId: string
): SuggestedCompetitor | null {
  const suggestion = db
    .select()
    .from(suggestedCompetitors)
    .where(
      and(
        eq(suggestedCompetitors.id, suggestionId),
        eq(suggestedCompetitors.workspaceId, workspaceId)
      )
    )
    .limit(1)
    .get();

  return suggestion ? mapSuggestion(suggestion) : null;
}

type SuggestedCompetitorPatch = Partial<
  Pick<
    SuggestedCompetitor,
    "name" | "domain" | "description" | "threatType" | "confidence" | "priority"
  >
> & {
  evidence?: string[];
};

export function updateSuggestedCompetitor(input: {
  workspaceId: string;
  suggestionId: string;
  updates: SuggestedCompetitorPatch;
}): SuggestedCompetitor | null {
  const existing = getSuggestedCompetitor(input.workspaceId, input.suggestionId);

  if (!existing) {
    return null;
  }

  const { evidence, ...updates } = input.updates;

  db.update(suggestedCompetitors)
    .set({
      ...updates,
      ...(evidence ? { evidenceJson: JSON.stringify(evidence) } : {}),
      updatedAt: new Date().toISOString()
    })
    .where(
      and(
        eq(suggestedCompetitors.id, input.suggestionId),
        eq(suggestedCompetitors.workspaceId, input.workspaceId)
      )
    )
    .run();

  return getSuggestedCompetitor(input.workspaceId, input.suggestionId);
}

export function deleteSuggestedCompetitor(workspaceId: string, suggestionId: string) {
  const existing = getSuggestedCompetitor(workspaceId, suggestionId);

  if (!existing) {
    return false;
  }

  db.delete(suggestedCompetitors)
    .where(
      and(
        eq(suggestedCompetitors.id, suggestionId),
        eq(suggestedCompetitors.workspaceId, workspaceId)
      )
    )
    .run();

  return true;
}

export function listSignals(workspaceId: string): Signal[] {
  return db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspaceId))
    .orderBy(desc(signals.impactScore))
    .all()
    .map(mapSignal);
}

export function getSignal(workspaceId: string, signalId: string): Signal | null {
  const signal = db
    .select()
    .from(signals)
    .where(and(eq(signals.id, signalId), eq(signals.workspaceId, workspaceId)))
    .limit(1)
    .get();

  return signal ? mapSignal(signal) : null;
}

export function listArtifacts(workspaceId: string): Artifact[] {
  return db
    .select()
    .from(artifacts)
    .where(eq(artifacts.workspaceId, workspaceId))
    .orderBy(desc(artifacts.createdAt))
    .all()
    .map(mapArtifact);
}

export function getArtifact(workspaceId: string, artifactId: string): Artifact | null {
  const artifact = db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, artifactId), eq(artifacts.workspaceId, workspaceId)))
    .limit(1)
    .get();

  return artifact ? mapArtifact(artifact) : null;
}

export function createSuggestedCompetitor(input: {
  workspaceId: string;
  name: string;
  domain: string;
  description: string;
}) {
  const suggestion = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name,
    domain: input.domain,
    description: input.description,
    threatType: "Direct",
    confidence: 65,
    priority: "Medium",
    evidenceJson: JSON.stringify([
      "Added manually by the founder.",
      "Will use Company Identify before paid enrichment in Phase 4."
    ]),
    status: "pending"
  };

  db.insert(suggestedCompetitors).values(suggestion).run();

  const created = db
    .select()
    .from(suggestedCompetitors)
    .where(eq(suggestedCompetitors.id, suggestion.id))
    .limit(1)
    .get();

  if (!created) {
    throw new Error("Failed to create suggested competitor");
  }

  return mapSuggestion(created);
}

export function decideSuggestedCompetitor(input: {
  workspaceId: string;
  suggestionId: string;
  decision: "approved" | "rejected";
}) {
  const suggestion = db
    .select()
    .from(suggestedCompetitors)
    .where(
      and(
        eq(suggestedCompetitors.id, input.suggestionId),
        eq(suggestedCompetitors.workspaceId, input.workspaceId)
      )
    )
    .limit(1)
    .get();

  if (!suggestion) {
    return null;
  }

  let createdCompetitor: CompetitorProfile | null = null;

  db.transaction((tx) => {
    tx.update(suggestedCompetitors)
      .set({
        status: input.decision,
        updatedAt: new Date().toISOString()
      })
      .where(eq(suggestedCompetitors.id, suggestion.id))
      .run();

    tx.insert(approvalDecisions).values({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      suggestionId: suggestion.id,
      decision: input.decision
    }).run();

    if (input.decision === "approved") {
      const existingCompetitor = tx
        .select()
        .from(competitors)
        .where(
          and(
            eq(competitors.workspaceId, input.workspaceId),
            eq(competitors.domain, suggestion.domain)
          )
        )
        .limit(1)
        .get();

      if (!existingCompetitor) {
        const competitorId = randomUUID();
        tx.insert(competitors).values({
          id: competitorId,
          workspaceId: input.workspaceId,
          sourceSuggestionId: suggestion.id,
          name: suggestion.name,
          domain: suggestion.domain,
          threatType: suggestion.threatType,
          trackingPriority: suggestion.priority,
          positioning: suggestion.description,
          headcount: "Pending Crustdata enrichment",
          hiring: "Queued for hiring signal check",
          funding: "Pending enrichment",
          confidence: suggestion.confidence
        }).run();

        const row = tx
          .select()
          .from(competitors)
          .where(eq(competitors.id, competitorId))
          .limit(1)
          .get();

        createdCompetitor = row ? mapCompetitor(row) : null;
      }
    }
  });

  const updatedSuggestion = db
    .select()
    .from(suggestedCompetitors)
    .where(eq(suggestedCompetitors.id, suggestion.id))
    .limit(1)
    .get();

  return {
    suggestion: updatedSuggestion ? mapSuggestion(updatedSuggestion) : null,
    competitor: createdCompetitor
  };
}

export function appendChatTurn(input: {
  workspaceId: string;
  userText: string;
}) {
  const chat =
    db
      .select()
      .from(chats)
      .where(eq(chats.workspaceId, input.workspaceId))
      .orderBy(asc(chats.createdAt))
      .limit(1)
      .get() ??
    createChat(input.workspaceId);

  const userMessage = {
    id: randomUUID(),
    chatId: chat.id,
    role: "user",
    content: input.userText
  };
  const agentMessage = {
    id: randomUUID(),
    chatId: chat.id,
    role: "agent",
    content:
      "I saved that message. The next agent phase will turn requests like this into structured tools, approvals, and artifacts."
  };

  db.insert(messages).values([userMessage, agentMessage]).run();

  return [
    { id: userMessage.id, role: "user" as const, text: userMessage.content },
    { id: agentMessage.id, role: "agent" as const, text: agentMessage.content }
  ];
}

function createChat(workspaceId: string) {
  const chat = {
    id: randomUUID(),
    workspaceId,
    title: "Counterless agent chat"
  };
  db.insert(chats).values(chat).run();
  return chat;
}

function mapProductProfile(row: typeof productProfiles.$inferSelect): ProductProfile {
  return {
    name: row.name,
    description: row.description,
    icp: row.icp,
    category: row.category,
    geography: row.geography,
    wedge: row.wedge
  };
}

function mapSuggestion(row: typeof suggestedCompetitors.$inferSelect): SuggestedCompetitor {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    description: row.description,
    threatType: row.threatType as SuggestedCompetitor["threatType"],
    confidence: row.confidence,
    priority: row.priority as SuggestedCompetitor["priority"],
    evidence: parseJson<string[]>(row.evidenceJson, []),
    status: row.status as SuggestedCompetitor["status"]
  };
}

function mapCompetitor(row: typeof competitors.$inferSelect): CompetitorProfile {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    threatType: row.threatType as CompetitorProfile["threatType"],
    trackingPriority: row.trackingPriority as CompetitorProfile["trackingPriority"],
    positioning: row.positioning,
    headcount: row.headcount,
    hiring: row.hiring,
    funding: row.funding,
    confidence: row.confidence
  };
}

function mapSignal(row: typeof signals.$inferSelect): Signal {
  const evidence = db
    .select()
    .from(evidenceSources)
    .where(
      and(
        eq(evidenceSources.signalId, row.id),
        eq(evidenceSources.workspaceId, row.workspaceId)
      )
    )
    .orderBy(asc(evidenceSources.createdAt))
    .all();

  return {
    id: row.id,
    competitor: row.competitor,
    title: row.title,
    summary: row.summary,
    impactScore: row.impactScore,
    priority: row.priority as Signal["priority"],
    detectedAt: row.detectedAt,
    evidence: evidence.map((source): Evidence => ({
      source: source.source,
      detail: source.detail,
      freshness: source.freshness
    })),
    meaning: row.meaning,
    recommendedMove: row.recommendedMove,
    counterMoves: parseJson(row.counterMovesJson, {
      defensive: "",
      offensive: "",
      ignore: ""
    })
  };
}

function mapArtifact(row: typeof artifacts.$inferSelect): Artifact {
  return {
    id: row.id,
    type: row.type as Artifact["type"],
    title: row.title,
    summary: row.summary,
    bullets: parseJson<string[]>(row.bulletsJson, [])
  };
}

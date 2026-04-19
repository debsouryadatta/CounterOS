import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import {
  agentActivities as mockActivities,
  approvedCompetitors,
  artifacts as mockArtifacts,
  productProfile,
  signals as mockSignals,
  suggestedCompetitors as mockSuggestions
} from "@/lib/mock-data";
import { db } from "./index";
import {
  agentActivities,
  artifacts,
  chats,
  competitors,
  evidenceSources,
  messages,
  productProfiles,
  signals,
  suggestedCompetitors,
  workspaces
} from "./schema";

function toCounterOS(value: string) {
  const previousBrand = ["Counter", "less"].join("");

  return value
    .replace(new RegExp(previousBrand.toUpperCase(), "g"), "COUNTEROS")
    .replace(new RegExp(previousBrand, "g"), "CounterOS")
    .replace(new RegExp(previousBrand.toLowerCase(), "g"), "counteros");
}

function normalizeCounterOSWorkspace(workspaceId: string) {
  const now = new Date().toISOString();
  const workspace = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
    .get();

  if (workspace) {
    const name = toCounterOS(workspace.name);

    if (name !== workspace.name) {
      db.update(workspaces)
        .set({ name, updatedAt: now })
        .where(eq(workspaces.id, workspace.id))
        .run();
    }
  }

  const profile = db
    .select()
    .from(productProfiles)
    .where(eq(productProfiles.workspaceId, workspaceId))
    .limit(1)
    .get();

  if (profile) {
    const updates = {
      name: toCounterOS(profile.name),
      description: toCounterOS(profile.description),
      icp: toCounterOS(profile.icp),
      category: toCounterOS(profile.category),
      geography: toCounterOS(profile.geography),
      wedge: toCounterOS(profile.wedge),
      updatedAt: now
    };

    if (
      updates.name !== profile.name ||
      updates.description !== profile.description ||
      updates.icp !== profile.icp ||
      updates.category !== profile.category ||
      updates.geography !== profile.geography ||
      updates.wedge !== profile.wedge
    ) {
      db.update(productProfiles)
        .set(updates)
        .where(eq(productProfiles.id, profile.id))
        .run();
    }
  }

  for (const suggestion of db
    .select()
    .from(suggestedCompetitors)
    .where(eq(suggestedCompetitors.workspaceId, workspaceId))
    .all()) {
    const updates = {
      name: toCounterOS(suggestion.name),
      domain: toCounterOS(suggestion.domain),
      description: toCounterOS(suggestion.description),
      threatType: toCounterOS(suggestion.threatType),
      priority: toCounterOS(suggestion.priority),
      evidenceJson: toCounterOS(suggestion.evidenceJson),
      status: toCounterOS(suggestion.status),
      intelligenceStatus: toCounterOS(suggestion.intelligenceStatus),
      updatedAt: now
    };

    if (
      updates.name !== suggestion.name ||
      updates.domain !== suggestion.domain ||
      updates.description !== suggestion.description ||
      updates.threatType !== suggestion.threatType ||
      updates.priority !== suggestion.priority ||
      updates.evidenceJson !== suggestion.evidenceJson ||
      updates.status !== suggestion.status ||
      updates.intelligenceStatus !== suggestion.intelligenceStatus
    ) {
      db.update(suggestedCompetitors)
        .set(updates)
        .where(eq(suggestedCompetitors.id, suggestion.id))
        .run();
    }
  }

  for (const competitor of db
    .select()
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))
    .all()) {
    const updates = {
      name: toCounterOS(competitor.name),
      domain: toCounterOS(competitor.domain),
      threatType: toCounterOS(competitor.threatType),
      trackingPriority: toCounterOS(competitor.trackingPriority),
      positioning: toCounterOS(competitor.positioning),
      headcount: toCounterOS(competitor.headcount),
      hiring: toCounterOS(competitor.hiring),
      funding: toCounterOS(competitor.funding),
      intelligenceStatus: toCounterOS(competitor.intelligenceStatus),
      updatedAt: now
    };

    if (
      updates.name !== competitor.name ||
      updates.domain !== competitor.domain ||
      updates.threatType !== competitor.threatType ||
      updates.trackingPriority !== competitor.trackingPriority ||
      updates.positioning !== competitor.positioning ||
      updates.headcount !== competitor.headcount ||
      updates.hiring !== competitor.hiring ||
      updates.funding !== competitor.funding ||
      updates.intelligenceStatus !== competitor.intelligenceStatus
    ) {
      db.update(competitors)
        .set(updates)
        .where(eq(competitors.id, competitor.id))
        .run();
    }
  }

  for (const signal of db
    .select()
    .from(signals)
    .where(eq(signals.workspaceId, workspaceId))
    .all()) {
    const updates = {
      competitor: toCounterOS(signal.competitor),
      title: toCounterOS(signal.title),
      summary: toCounterOS(signal.summary),
      priority: toCounterOS(signal.priority),
      detectedAt: toCounterOS(signal.detectedAt),
      meaning: toCounterOS(signal.meaning),
      recommendedMove: toCounterOS(signal.recommendedMove),
      counterMovesJson: toCounterOS(signal.counterMovesJson),
      updatedAt: now
    };

    if (
      updates.competitor !== signal.competitor ||
      updates.title !== signal.title ||
      updates.summary !== signal.summary ||
      updates.priority !== signal.priority ||
      updates.detectedAt !== signal.detectedAt ||
      updates.meaning !== signal.meaning ||
      updates.recommendedMove !== signal.recommendedMove ||
      updates.counterMovesJson !== signal.counterMovesJson
    ) {
      db.update(signals).set(updates).where(eq(signals.id, signal.id)).run();
    }
  }

  for (const evidence of db
    .select()
    .from(evidenceSources)
    .where(eq(evidenceSources.workspaceId, workspaceId))
    .all()) {
    const updates = {
      source: toCounterOS(evidence.source),
      detail: toCounterOS(evidence.detail),
      freshness: toCounterOS(evidence.freshness)
    };

    if (
      updates.source !== evidence.source ||
      updates.detail !== evidence.detail ||
      updates.freshness !== evidence.freshness
    ) {
      db.update(evidenceSources)
        .set(updates)
        .where(eq(evidenceSources.id, evidence.id))
        .run();
    }
  }

  for (const artifact of db
    .select()
    .from(artifacts)
    .where(eq(artifacts.workspaceId, workspaceId))
    .all()) {
    const updates = {
      type: toCounterOS(artifact.type),
      title: toCounterOS(artifact.title),
      summary: toCounterOS(artifact.summary),
      bulletsJson: toCounterOS(artifact.bulletsJson),
      updatedAt: now
    };

    if (
      updates.type !== artifact.type ||
      updates.title !== artifact.title ||
      updates.summary !== artifact.summary ||
      updates.bulletsJson !== artifact.bulletsJson
    ) {
      db.update(artifacts).set(updates).where(eq(artifacts.id, artifact.id)).run();
    }
  }

  for (const chat of db
    .select()
    .from(chats)
    .where(eq(chats.workspaceId, workspaceId))
    .all()) {
    const title = toCounterOS(chat.title);

    if (title !== chat.title) {
      db.update(chats)
        .set({ title, updatedAt: now })
        .where(eq(chats.id, chat.id))
        .run();
    }

    for (const message of db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chat.id))
      .all()) {
      const content = toCounterOS(message.content);

      if (content !== message.content) {
        db.update(messages)
          .set({ content })
          .where(eq(messages.id, message.id))
          .run();
      }
    }
  }

  for (const activity of db
    .select()
    .from(agentActivities)
    .where(eq(agentActivities.workspaceId, workspaceId))
    .all()) {
    const updates = {
      label: toCounterOS(activity.label),
      source: toCounterOS(activity.source),
      status: toCounterOS(activity.status),
      evidence: toCounterOS(activity.evidence),
      updatedAt: now
    };

    if (
      updates.label !== activity.label ||
      updates.source !== activity.source ||
      updates.status !== activity.status ||
      updates.evidence !== activity.evidence
    ) {
      db.update(agentActivities)
        .set(updates)
        .where(eq(agentActivities.id, activity.id))
        .run();
    }
  }
}

export function createDefaultWorkspaceForUser(userId: string, email: string, name?: string | null) {
  const existingWorkspace = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1)
    .get();

  if (existingWorkspace) {
    normalizeCounterOSWorkspace(existingWorkspace.id);
    return existingWorkspace;
  }

  const workspaceId = randomUUID();
  const displayName = name?.trim() || email.split("@")[0] || "Founder";

  db.transaction((tx) => {
    tx.insert(workspaces).values({
      id: workspaceId,
      userId,
      name: `${displayName}'s CounterOS workspace`
    }).run();

    tx.insert(productProfiles).values({
      id: randomUUID(),
      workspaceId,
      ...productProfile
    }).run();

    for (const suggestion of mockSuggestions) {
      tx.insert(suggestedCompetitors).values({
        id: randomUUID(),
        workspaceId,
        name: suggestion.name,
        domain: suggestion.domain,
        description: suggestion.description,
        threatType: suggestion.threatType,
        confidence: suggestion.confidence,
        priority: suggestion.priority,
        evidenceJson: JSON.stringify(suggestion.evidence),
        status: suggestion.status
      }).run();
    }

    for (const competitor of approvedCompetitors) {
      tx.insert(competitors).values({
        id: randomUUID(),
        workspaceId,
        name: competitor.name,
        domain: competitor.domain,
        threatType: competitor.threatType,
        trackingPriority: competitor.trackingPriority,
        positioning: competitor.positioning,
        headcount: competitor.headcount,
        hiring: competitor.hiring,
        funding: competitor.funding,
        confidence: competitor.confidence
      }).run();
    }

    for (const signal of mockSignals) {
      const signalId = randomUUID();
      tx.insert(signals).values({
        id: signalId,
        workspaceId,
        competitor: signal.competitor,
        title: signal.title,
        summary: signal.summary,
        impactScore: signal.impactScore,
        priority: signal.priority,
        detectedAt: signal.detectedAt,
        meaning: signal.meaning,
        recommendedMove: signal.recommendedMove,
        counterMovesJson: JSON.stringify(signal.counterMoves)
      }).run();

      for (const evidence of signal.evidence) {
        tx.insert(evidenceSources).values({
          id: randomUUID(),
          workspaceId,
          signalId,
          source: evidence.source,
          detail: evidence.detail,
          freshness: evidence.freshness
        }).run();
      }
    }

    for (const artifact of mockArtifacts) {
      tx.insert(artifacts).values({
        id: randomUUID(),
        workspaceId,
        type: artifact.type,
        title: artifact.title,
        summary: artifact.summary,
        bulletsJson: JSON.stringify(artifact.bullets)
      }).run();
    }

    const chatId = randomUUID();
    tx.insert(chats).values({
      id: chatId,
      workspaceId,
      title: "CounterOS agent chat"
    }).run();
    tx.insert(messages).values({
      id: randomUUID(),
      chatId,
      role: "agent",
      content:
        "I have your workspace loaded from SQLite. I can review suggested competitors, explain top signals, or draft a counter-move."
    }).run();

    for (const activity of mockActivities) {
      tx.insert(agentActivities).values({
        id: randomUUID(),
        workspaceId,
        label: activity.label,
        source: activity.source,
        status: activity.status,
        evidence: activity.evidence
      }).run();
    }
  });

  const workspace = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
    .get();

  if (!workspace) {
    throw new Error("Failed to create default workspace");
  }

  return workspace;
}

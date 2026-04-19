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

export function createDefaultWorkspaceForUser(userId: string, email: string, name?: string | null) {
  const existingWorkspace = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1)
    .get();

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const workspaceId = randomUUID();
  const displayName = name?.trim() || email.split("@")[0] || "Founder";

  db.transaction((tx) => {
    tx.insert(workspaces).values({
      id: workspaceId,
      userId,
      name: `${displayName}'s Counterless workspace`
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
      title: "Counterless agent chat"
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

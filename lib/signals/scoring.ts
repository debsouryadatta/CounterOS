import type {
  CompetitorTrackingPriority,
  SignalPriority,
  SignalScoreBreakdown,
  SignalScoreFactor,
  SignalScoreInput,
  SignalScoreResult
} from "./types";

export const SIGNAL_SCORE_WEIGHTS: Record<SignalScoreFactor, number> = {
  strategicRelevance: 0.25,
  freshness: 0.2,
  confidence: 0.2,
  competitorPriority: 0.15,
  customerImpact: 0.1,
  actionability: 0.1
};

const COMPETITOR_PRIORITY_SCORES: Record<CompetitorTrackingPriority, number> = {
  High: 90,
  Medium: 60,
  Low: 35,
  Unknown: 45
};

export function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const score = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreCompetitorPriority(
  priority: number | CompetitorTrackingPriority | null | undefined
): number {
  if (typeof priority === "number") {
    return normalizeScore(priority);
  }

  return COMPETITOR_PRIORITY_SCORES[priority ?? "Unknown"];
}

export function freshnessScoreFromAgeDays(ageDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays < 0) {
    return 100;
  }

  if (ageDays <= 7) return 100;
  if (ageDays <= 14) return 85;
  if (ageDays <= 30) return 70;
  if (ageDays <= 60) return 50;
  if (ageDays <= 90) return 30;
  if (ageDays <= 180) return 15;
  return 0;
}

export function freshnessScoreFromDate(
  observedAt: Date | string,
  now: Date | string = new Date()
): number {
  const observedTime = new Date(observedAt).getTime();
  const nowTime = new Date(now).getTime();

  if (!Number.isFinite(observedTime) || !Number.isFinite(nowTime)) {
    return 0;
  }

  const ageDays = (nowTime - observedTime) / (24 * 60 * 60 * 1000);
  return freshnessScoreFromAgeDays(ageDays);
}

export function classifySignalPriority(input: {
  impactScore: number;
  confidence: number;
  evidenceCount?: number;
}): SignalPriority {
  const impactScore = normalizeScore(input.impactScore);
  const confidence = normalizeScore(input.confidence);
  const evidenceCount = input.evidenceCount ?? 1;

  if (confidence < 45 || evidenceCount <= 0) {
    return impactScore >= 40 ? "Verify" : "Ignore";
  }

  if (impactScore >= 75) return "Act now";
  if (impactScore >= 50) return "Watch";
  if (impactScore >= 35) return "Verify";
  return "Ignore";
}

export function scoreSignal(input: SignalScoreInput): SignalScoreResult {
  const competitorPriority = scoreCompetitorPriority(input.competitorPriority);
  const freshness = normalizeScore(input.freshness);
  const confidence = normalizeScore(input.confidence);
  const customerImpact = normalizeScore(input.customerImpact);
  const actionability = normalizeScore(input.actionability);
  const strategicRelevance = normalizeScore(
    input.strategicRelevance ??
      Math.round((competitorPriority + customerImpact + actionability) / 3)
  );

  const normalizedScores: Record<SignalScoreFactor, number> = {
    strategicRelevance,
    freshness,
    confidence,
    competitorPriority,
    customerImpact,
    actionability
  };

  const breakdown = Object.entries(SIGNAL_SCORE_WEIGHTS).map(([factor, weight]) => {
    const typedFactor = factor as SignalScoreFactor;
    const normalized = normalizedScores[typedFactor];
    const contribution = normalized * weight;

    return {
      factor: typedFactor,
      raw: normalized,
      normalized,
      weight,
      contribution
    } satisfies SignalScoreBreakdown;
  });

  const impactScore = normalizeScore(
    breakdown.reduce((total, item) => total + item.contribution, 0)
  );

  return {
    impactScore,
    priority: classifySignalPriority({
      impactScore,
      confidence,
      evidenceCount: input.evidenceCount
    }),
    breakdown
  };
}

export function sortSignalsByScore<T extends { impactScore: number; detectedAt?: string }>(
  signals: T[]
): T[] {
  return [...signals].sort((left, right) => {
    const scoreDelta = right.impactScore - left.impactScore;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const leftTime = left.detectedAt ? new Date(left.detectedAt).getTime() : 0;
    const rightTime = right.detectedAt ? new Date(right.detectedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

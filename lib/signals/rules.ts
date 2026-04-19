import type {
  JobPostingSignalInput,
  PersonMovementSignalInput,
  SignalEvidenceInput,
  SignalRuleMatch
} from "./types";

const LEADERSHIP_PATTERN =
  /\b(chief|ceo|cto|cpo|cro|cmo|coo|cfo|founder|president|vp|vice president|head of|director|leader)\b/i;
const GTM_PATTERN =
  /\b(gtm|go[- ]to[- ]market|sales|account executive|enterprise ae|revenue|growth|marketing|demand generation|partnership|customer success|solutions consultant)\b/i;
const PRODUCT_ENGINEERING_PATTERN =
  /\b(product|engineer|engineering|developer|platform|infrastructure|data|machine learning|ml|ai|security|design|ux|research)\b/i;

function compactEvidence(evidence: SignalEvidenceInput[]): SignalEvidenceInput[] {
  return evidence.filter((item) => item.detail.trim().length > 0);
}

function jobEvidence(job: JobPostingSignalInput): SignalEvidenceInput {
  return {
    source: job.companyName ?? "jobs",
    detail: [job.title, job.location, job.department].filter(Boolean).join(" | "),
    observedAt: job.postedAt,
    url: job.url,
    kind: "job_posting"
  };
}

function personEvidence(person: PersonMovementSignalInput): SignalEvidenceInput {
  return {
    source: person.source ?? "people",
    detail: [
      person.name,
      person.title,
      person.previousCompany && person.currentCompany
        ? `${person.previousCompany} -> ${person.currentCompany}`
        : person.currentCompany
    ]
      .filter(Boolean)
      .join(" | "),
    observedAt: person.observedAt ?? person.startedAt,
    url: person.url,
    kind: "person_profile"
  };
}

function normalizeLocation(location: string | undefined): string {
  return (location ?? "")
    .toLowerCase()
    .replace(/\b(remote|hybrid|onsite|on-site)\b/g, "")
    .replace(/[^a-z0-9\s,.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectHiringSpike(input: {
  competitorName: string;
  currentJobs: JobPostingSignalInput[];
  baselineJobCount: number;
  minimumNewRoles?: number;
  spikeMultiplier?: number;
}): SignalRuleMatch | null {
  const currentCount = input.currentJobs.length;
  const baselineCount = Math.max(0, input.baselineJobCount);
  const newRoles = Math.max(0, currentCount - baselineCount);
  const minimumNewRoles = input.minimumNewRoles ?? 5;
  const spikeMultiplier = input.spikeMultiplier ?? 1.5;
  const ratio = baselineCount === 0 ? currentCount : currentCount / baselineCount;

  if (newRoles < minimumNewRoles && ratio < spikeMultiplier) {
    return null;
  }

  return {
    ruleId: "hiring_spike",
    title: `${input.competitorName} hiring spike`,
    summary: `${input.competitorName} has ${currentCount} tracked open roles versus a baseline of ${baselineCount}.`,
    confidence: currentCount >= minimumNewRoles ? 80 : 65,
    customerImpact: ratio >= 2 ? 80 : 65,
    actionability: 70,
    evidence: compactEvidence(input.currentJobs.slice(0, 5).map(jobEvidence)),
    metadata: {
      currentCount,
      baselineCount,
      newRoles,
      ratio
    }
  };
}

export function detectLeadershipOrGtmHire(input: {
  competitorName: string;
  jobs: JobPostingSignalInput[];
}): SignalRuleMatch | null {
  const matches = input.jobs.filter((job) => {
    const searchableText = [job.title, job.department, job.seniority].filter(Boolean).join(" ");
    return LEADERSHIP_PATTERN.test(searchableText) || GTM_PATTERN.test(searchableText);
  });

  if (matches.length === 0) {
    return null;
  }

  return {
    ruleId: "leadership_gtm_hire",
    title: `${input.competitorName} is adding leadership or GTM capacity`,
    summary: `${input.competitorName} has ${matches.length} tracked leadership or go-to-market role${matches.length === 1 ? "" : "s"}.`,
    confidence: matches.length >= 3 ? 85 : 72,
    customerImpact: 75,
    actionability: 80,
    evidence: compactEvidence(matches.slice(0, 5).map(jobEvidence)),
    metadata: {
      matchedJobIds: matches.map((job) => job.id).filter(Boolean),
      matchedCount: matches.length
    }
  };
}

export function detectProductEngineeringFocus(input: {
  competitorName: string;
  jobs: JobPostingSignalInput[];
  minimumMatches?: number;
}): SignalRuleMatch | null {
  const minimumMatches = input.minimumMatches ?? 3;
  const matches = input.jobs.filter((job) => {
    const searchableText = [job.title, job.department].filter(Boolean).join(" ");
    return PRODUCT_ENGINEERING_PATTERN.test(searchableText);
  });

  if (matches.length < minimumMatches) {
    return null;
  }

  return {
    ruleId: "product_engineering_focus",
    title: `${input.competitorName} is investing in product or engineering`,
    summary: `${input.competitorName} has ${matches.length} tracked product, engineering, data, or AI role${matches.length === 1 ? "" : "s"}.`,
    confidence: matches.length >= minimumMatches + 3 ? 82 : 70,
    customerImpact: 70,
    actionability: 65,
    evidence: compactEvidence(matches.slice(0, 5).map(jobEvidence)),
    metadata: {
      matchedJobIds: matches.map((job) => job.id).filter(Boolean),
      matchedCount: matches.length
    }
  };
}

export function detectNewGeography(input: {
  competitorName: string;
  jobs: JobPostingSignalInput[];
  knownGeographies: string[];
  minimumMatches?: number;
}): SignalRuleMatch | null {
  const known = new Set(input.knownGeographies.map(normalizeLocation).filter(Boolean));
  const byLocation = new Map<string, JobPostingSignalInput[]>();

  for (const job of input.jobs) {
    const location = normalizeLocation(job.location);
    if (!location || known.has(location)) {
      continue;
    }

    byLocation.set(location, [...(byLocation.get(location) ?? []), job]);
  }

  const minimumMatches = input.minimumMatches ?? 2;
  const [location, matches] =
    [...byLocation.entries()].sort((left, right) => right[1].length - left[1].length)[0] ?? [];

  if (!location || !matches || matches.length < minimumMatches) {
    return null;
  }

  return {
    ruleId: "new_geography",
    title: `${input.competitorName} may be entering ${location}`,
    summary: `${input.competitorName} has ${matches.length} tracked open role${matches.length === 1 ? "" : "s"} in ${location}, which is not in the known geography list.`,
    confidence: matches.length >= 4 ? 78 : 65,
    customerImpact: 72,
    actionability: 75,
    evidence: compactEvidence(matches.slice(0, 5).map(jobEvidence)),
    metadata: {
      location,
      matchedJobIds: matches.map((job) => job.id).filter(Boolean),
      matchedCount: matches.length
    }
  };
}

export function detectPeopleMovement(input: {
  competitorName: string;
  people: PersonMovementSignalInput[];
}): SignalRuleMatch | null {
  const competitorName = input.competitorName.toLowerCase();
  const matches = input.people.filter((person) => {
    const currentCompany = person.currentCompany?.toLowerCase() ?? "";
    const title = person.title ?? "";

    return (
      currentCompany.includes(competitorName) &&
      (LEADERSHIP_PATTERN.test(title) || GTM_PATTERN.test(title) || PRODUCT_ENGINEERING_PATTERN.test(title))
    );
  });

  if (matches.length === 0) {
    return null;
  }

  return {
    ruleId: "people_movement",
    title: `${input.competitorName} has notable people movement`,
    summary: `${matches.length} tracked strategic hire${matches.length === 1 ? "" : "s"} or role movement${matches.length === 1 ? "" : "s"} now point to ${input.competitorName}.`,
    confidence: matches.length >= 2 ? 82 : 68,
    customerImpact: 76,
    actionability: 72,
    evidence: compactEvidence(matches.slice(0, 5).map(personEvidence)),
    metadata: {
      personIds: matches.map((person) => person.personId).filter(Boolean),
      matchedCount: matches.length
    }
  };
}

export function detectJobSignalRules(input: {
  competitorName: string;
  currentJobs: JobPostingSignalInput[];
  baselineJobCount?: number;
  knownGeographies?: string[];
}): SignalRuleMatch[] {
  return [
    detectHiringSpike({
      competitorName: input.competitorName,
      currentJobs: input.currentJobs,
      baselineJobCount: input.baselineJobCount ?? input.currentJobs.length
    }),
    detectLeadershipOrGtmHire({
      competitorName: input.competitorName,
      jobs: input.currentJobs
    }),
    detectProductEngineeringFocus({
      competitorName: input.competitorName,
      jobs: input.currentJobs
    }),
    detectNewGeography({
      competitorName: input.competitorName,
      jobs: input.currentJobs,
      knownGeographies: input.knownGeographies ?? []
    })
  ].filter((match): match is SignalRuleMatch => match !== null);
}

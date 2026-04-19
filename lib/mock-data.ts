import type {
  AgentActivity,
  Artifact,
  CompetitorProfile,
  ProductProfile,
  Signal,
  SuggestedCompetitor
} from "./types";

export const productProfile: ProductProfile = {
  name: "Counterless demo workspace",
  description: "AI receptionist and front-desk automation for dental clinics.",
  icp: "Independent and small-group dental clinics with 3-20 staff members.",
  category: "Healthcare operations automation",
  geography: "United States",
  wedge: "Fast setup, lower complexity, and clinic-friendly workflows."
};

export const suggestedCompetitors: SuggestedCompetitor[] = [
  {
    id: "suggestion-1",
    name: "ClinicVoice AI",
    domain: "clinicvoice.example",
    description:
      "AI phone agent positioned for small healthcare practices and front-desk automation.",
    threatType: "Direct",
    confidence: 91,
    priority: "High",
    evidence: [
      "Matches the same buyer: clinic owner or practice manager.",
      "Messaging overlaps on missed calls and appointment booking.",
      "Recent hiring hints at healthcare sales expansion."
    ],
    status: "pending",
    intelligenceStatus: "unresolved"
  },
  {
    id: "suggestion-2",
    name: "CareDesk Automations",
    domain: "caredesk.example",
    description:
      "Workflow automation suite for multi-location healthcare operators.",
    threatType: "Enterprise",
    confidence: 78,
    priority: "Medium",
    evidence: [
      "Targets larger healthcare groups but overlaps in front-office workflows.",
      "Promotes enterprise onboarding and compliance controls.",
      "Likely to move downmarket if growth slows."
    ],
    status: "pending",
    intelligenceStatus: "unresolved"
  },
  {
    id: "suggestion-3",
    name: "AfterHours Answering",
    domain: "afterhours.example",
    description:
      "Human answering service used by clinics that have not adopted AI reception yet.",
    threatType: "Substitute",
    confidence: 72,
    priority: "Low",
    evidence: [
      "Solves the same missed-call pain with a service-heavy model.",
      "Appears in search results for clinic answering services.",
      "Useful for objection handling in sales battlecards."
    ],
    status: "pending",
    intelligenceStatus: "unresolved"
  }
];

export const approvedCompetitors: CompetitorProfile[] = [
  {
    id: "competitor-1",
    name: "FrontOffice Flow",
    domain: "frontofficeflow.example",
    threatType: "Direct",
    trackingPriority: "High",
    positioning: "AI front desk for clinics with scheduling and reminder workflows.",
    headcount: "82 employees",
    hiring: "Adding enterprise AEs and implementation specialists",
    funding: "Series A, estimated $18M raised",
    confidence: 88,
    intelligenceStatus: "unresolved"
  },
  {
    id: "competitor-2",
    name: "PatientBridge",
    domain: "patientbridge.example",
    threatType: "Indirect",
    trackingPriority: "Medium",
    positioning: "Patient communication hub with automation add-ons.",
    headcount: "240 employees",
    hiring: "Hiring product marketers and partnership roles",
    funding: "Growth stage, estimated $55M raised",
    confidence: 81,
    intelligenceStatus: "unresolved"
  }
];

export const signals: Signal[] = [
  {
    id: "signal-1",
    competitor: "FrontOffice Flow",
    title: "Homepage shifted toward multi-location healthcare groups",
    summary:
      "Messaging moved from small-clinic reception to healthcare group front-office automation.",
    impactScore: 87,
    priority: "Act now",
    detectedAt: "Today",
    evidence: [
      {
        source: "Homepage snapshot",
        detail:
          "Primary headline now references multi-location healthcare groups instead of independent clinics.",
        freshness: "Fresh"
      },
      {
        source: "Hiring signal",
        detail:
          "Open roles include enterprise account executives and implementation managers.",
        freshness: "This week"
      },
      {
        source: "Company enrichment",
        detail:
          "Headcount growth appears concentrated in GTM and customer success functions.",
        freshness: "Recent"
      }
    ],
    meaning:
      "They may be moving upmarket. That can leave smaller clinics underserved and more price-sensitive.",
    recommendedMove:
      "Defend the small-clinic wedge with clearer positioning and a comparison page for clinics that do not want enterprise complexity.",
    counterMoves: {
      defensive:
        "Sharpen homepage copy around fast setup, clinic simplicity, and no enterprise implementation overhead.",
      offensive:
        "Target small clinic groups that may be ignored as the competitor chases larger accounts.",
      ignore:
        "Ignore only if your current pipeline is already focused on multi-location groups."
    }
  },
  {
    id: "signal-2",
    competitor: "PatientBridge",
    title: "New pricing page adds annual minimum language",
    summary:
      "The competitor appears to be nudging customers toward annual contracts and higher ACV.",
    impactScore: 74,
    priority: "Watch",
    detectedAt: "Yesterday",
    evidence: [
      {
        source: "Pricing page snapshot",
        detail:
          "New wording references annual plan minimums and custom onboarding.",
        freshness: "Fresh"
      },
      {
        source: "Sales artifact",
        detail:
          "Comparison copy now emphasizes enterprise support and dedicated onboarding.",
        freshness: "Recent"
      }
    ],
    meaning:
      "A pricing floor can create room for a simpler, lower-friction alternative for smaller clinics.",
    recommendedMove:
      "Prepare a short pricing objection response and watch whether lost deals mention annual commitment.",
    counterMoves: {
      defensive:
        "Keep transparent monthly pricing visible for smaller practices.",
      offensive:
        "Run a campaign around flexible adoption for clinics that cannot commit annually.",
      ignore:
        "Do nothing this week unless sales starts hearing pricing objections."
    }
  },
  {
    id: "signal-3",
    competitor: "FrontOffice Flow",
    title: "Three new implementation roles appeared in the US",
    summary:
      "The competitor is staffing post-sale delivery, which can indicate larger or more complex deployments.",
    impactScore: 68,
    priority: "Verify",
    detectedAt: "2 days ago",
    evidence: [
      {
        source: "Jobs search",
        detail:
          "Implementation manager and solutions consultant roles were indexed recently.",
        freshness: "This week"
      },
      {
        source: "Role mix",
        detail:
          "Openings skew toward implementation rather than support.",
        freshness: "Recent"
      }
    ],
    meaning:
      "This supports the upmarket hypothesis, but it needs one more signal before overreacting.",
    recommendedMove:
      "Verify with pricing/page changes and customer segment messaging before changing roadmap priorities.",
    counterMoves: {
      defensive:
        "Document why Counterless-style buyers value lightweight setup.",
      offensive:
        "Use implementation-heavy language against them in SMB sales conversations.",
      ignore:
        "Ignore as a standalone hiring signal until paired with pricing or positioning changes."
    }
  }
];

export const artifacts: Artifact[] = [
  {
    id: "artifact-1",
    type: "Battlecard",
    title: "FrontOffice Flow small-clinic battlecard",
    summary:
      "Use when a buyer asks whether they should choose a broader healthcare group platform.",
    bullets: [
      "Lead with fast setup and fewer workflow changes.",
      "Ask whether the clinic needs enterprise onboarding or just better call handling.",
      "Position Counterless around lower complexity for small teams.",
      "Offer a 14-day pilot with appointment-booking success criteria."
    ]
  },
  {
    id: "artifact-2",
    type: "Target accounts",
    title: "Small clinic groups to protect",
    summary:
      "Draft target-account segment for clinics likely to value flexible adoption.",
    bullets: [
      "3-10 location dental groups in the US.",
      "High missed-call volume or after-hours booking needs.",
      "No dedicated enterprise IT function.",
      "Currently using answering services or manual voicemail workflows."
    ]
  }
];

export const agentActivities: AgentActivity[] = [
  {
    id: "activity-1",
    label: "Read product profile",
    source: "Workspace",
    status: "Done",
    evidence: "ICP, category, geography, and wedge are available."
  },
  {
    id: "activity-2",
    label: "Generate competitor search plan",
    source: "Agent",
    status: "Done",
    evidence: "Use company search, identify, and approval queue before enrichment."
  },
  {
    id: "activity-3",
    label: "Prepare Crustdata company queries",
    source: "Crustdata",
    status: "Queued",
    evidence: "Waiting for API key and Phase 4 integration."
  },
  {
    id: "activity-4",
    label: "Create approval cards",
    source: "Agent",
    status: "Needs approval",
    evidence: "Three suggested competitors are ready for founder review."
  }
];

import { createHash, randomUUID } from "crypto";
import Database from "better-sqlite3";

type WorkspaceRow = {
  id: string;
};

type IdRow = {
  id: string;
};

type SnapshotRow = {
  id: string;
  diff_summary: string | null;
};

type CountRow = {
  count: number;
};

type PageType = "homepage" | "pricing" | "changelog" | "blog" | "docs" | "careers" | "other";

type TrackedPageSeed = {
  url: string;
  pageType: PageType;
  title: string;
  extractedText: string;
};

type SignalSeed = {
  title: string;
  summary: string;
  impactScore: number;
  priority: "Act now" | "Watch" | "Verify" | "Ignore";
  meaning: string;
  recommendedMove: string;
  counterMoves: {
    defensive: string;
    offensive: string;
    ignore: string;
  };
  evidence: Array<{
    source: string;
    detail: string;
    url: string;
  }>;
};

const databaseUrl = process.env.DATABASE_URL ?? "file:./local-dev/dev.db";
const sqlitePath = databaseUrl.startsWith("file:")
  ? databaseUrl.replace("file:", "")
  : databaseUrl;
const db = new Database(sqlitePath);

db.pragma("foreign_keys = ON");

const workspace = db
  .prepare("select id from workspaces order by created_at limit 1")
  .get() as WorkspaceRow | undefined;

if (!workspace) {
  throw new Error("Create a workspace before seeding Submagic tracking data.");
}

const now = new Date().toISOString();

const productProfile = db
  .prepare("select id from product_profiles where workspace_id = ? limit 1")
  .get(workspace.id) as IdRow | undefined;

if (!productProfile) {
  db.prepare(
    `insert into product_profiles (
      id, workspace_id, name, description, icp, category, geography, wedge
    ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    workspace.id,
    "AI video workspace",
    "Tracks AI video editing competitors, pricing, product launches, and automation moves.",
    "Creators, agencies, and marketing teams producing short-form video",
    "AI video editing",
    "Global",
    "Fast short-form video production with clear competitive positioning"
  );
}

const competitorId = ensureSubmagicCompetitor(workspace.id);

const trackedPageSeeds: TrackedPageSeed[] = [
  {
    url: "https://www.submagic.co/",
    pageType: "homepage",
    title: "Submagic - Create viral shorts in seconds with AI",
    extractedText:
      "Submagic homepage: Create viral shorts in seconds with AI. Raw footage to viral shorts in 1 click. Features include AI captions, Magic Clips, AI Auto Edit, B-Roll, publishing, AI actors, collaboration, and a Submagic API launch banner."
  },
  {
    url: "https://www.submagic.co/pricing",
    pageType: "pricing",
    title: "Pricing for Submagic",
    extractedText:
      "Submagic pricing: Starter, Pro, Business + API, Custom Plan, and API credit packs. Business + API includes team video production, 100 videos, 30 minute videos, 4K and 60 FPS export, custom templates, brand assets, priority support, and API integrations."
  },
  {
    url: "https://www.submagic.co/api",
    pageType: "docs",
    title: "Video Editing API For AI Captions, B-Rolls, & More",
    extractedText:
      "Submagic API page: programmatically generate AI-powered captions, create projects, use webhooks, automate video workflows, and scale video processing for SaaS apps or agencies."
  },
  {
    url: "https://cord-wall-f76.notion.site/submagic-job-board",
    pageType: "careers",
    title: "Submagic job board",
    extractedText:
      "Submagic careers tracker: job board linked from the Submagic homepage for monitoring hiring and team-growth signals."
  }
];

void Promise.all(trackedPageSeeds.map(hydratePageSeed))
  .then((trackedPages) => {
    for (const page of trackedPages) {
      const trackedPageId = ensureTrackedPage(workspace.id, competitorId, page);
      ensureBaselineSnapshot(workspace.id, trackedPageId, page);
    }

    const createdSignals = seedSignals(workspace.id);
    ensureSeedActivity(workspace.id, createdSignals);

    console.log(
      `Submagic seed complete: competitor=${competitorId}, pages=${trackedPages.length}, newSignals=${createdSignals}.`
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

function ensureSubmagicCompetitor(workspaceId: string) {
  const existing = db
    .prepare("select id from competitors where workspace_id = ? and domain = ? limit 1")
    .get(workspaceId, "submagic.co") as IdRow | undefined;

  if (existing) {
    db.prepare(
      `update competitors
       set name = ?, threat_type = ?, tracking_priority = ?, positioning = ?,
           headcount = ?, hiring = ?, funding = ?, confidence = ?, updated_at = ?
       where id = ? and workspace_id = ?`
    ).run(
      "Submagic",
      "Direct",
      "High",
      "AI short-form video editor for creators, agencies, marketers, and teams. Current positioning emphasizes one-click shorts, captions, Magic Clips, publishing, AI actors, API automation, and team workflows.",
      "Pending enrichment",
      "Careers page tracked",
      "Pending enrichment",
      82,
      now,
      existing.id,
      workspaceId
    );

    return existing.id;
  }

  const id = randomUUID();

  db.prepare(
    `insert into competitors (
      id, workspace_id, name, domain, threat_type, tracking_priority, positioning,
      headcount, hiring, funding, confidence, intelligence_status
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    workspaceId,
    "Submagic",
    "submagic.co",
    "Direct",
    "High",
    "AI short-form video editor for creators, agencies, marketers, and teams. Current positioning emphasizes one-click shorts, captions, Magic Clips, publishing, AI actors, API automation, and team workflows.",
    "Pending enrichment",
    "Careers page tracked",
    "Pending enrichment",
    82,
    "unresolved"
  );

  return id;
}

function ensureTrackedPage(
  workspaceId: string,
  competitorId: string,
  page: TrackedPageSeed
) {
  const existing = db
    .prepare("select id from tracked_pages where workspace_id = ? and url = ? limit 1")
    .get(workspaceId, page.url) as IdRow | undefined;

  if (existing) {
    db.prepare(
      `update tracked_pages
       set competitor_id = ?, page_type = ?, status = ?, last_error = null, updated_at = ?
       where id = ? and workspace_id = ?`
    ).run(competitorId, page.pageType, "active", now, existing.id, workspaceId);

    return existing.id;
  }

  const id = randomUUID();

  db.prepare(
    `insert into tracked_pages (
      id, workspace_id, competitor_id, url, page_type, status
    ) values (?, ?, ?, ?, ?, ?)`
  ).run(id, workspaceId, competitorId, page.url, page.pageType, "active");

  return id;
}

function ensureBaselineSnapshot(
  workspaceId: string,
  trackedPageId: string,
  page: TrackedPageSeed
) {
  const existing = db
    .prepare(
      `select id, diff_summary
       from page_snapshots
       where workspace_id = ? and tracked_page_id = ?
       order by fetched_at asc
       limit 1`
    )
    .get(workspaceId, trackedPageId) as SnapshotRow | undefined;
  const snapshotCount = db
    .prepare(
      "select count(*) as count from page_snapshots where workspace_id = ? and tracked_page_id = ?"
    )
    .get(workspaceId, trackedPageId) as CountRow;
  const hash = createHash("sha256").update(page.extractedText).digest("hex");

  if (existing) {
    if (snapshotCount.count === 1 && existing.diff_summary === "Seed baseline captured.") {
      db.prepare(
        `update page_snapshots
         set title = ?, extracted_text = ?, text_hash = ?, fetched_at = ?
         where id = ? and workspace_id = ?`
      ).run(page.title, page.extractedText, hash, now, existing.id, workspaceId);

      db.prepare(
        `update tracked_pages
         set last_snapshot_at = ?, status = ?, last_error = null, updated_at = ?
         where id = ? and workspace_id = ?`
      ).run(now, "active", now, trackedPageId, workspaceId);
    }

    return;
  }

  db.prepare(
    `insert into page_snapshots (
      id, workspace_id, tracked_page_id, url, title, extracted_text, text_hash, diff_summary, fetched_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    workspaceId,
    trackedPageId,
    page.url,
    page.title,
    page.extractedText,
    hash,
    "Seed baseline captured.",
    now
  );

  db.prepare(
    `update tracked_pages
     set last_snapshot_at = ?, status = ?, last_error = null, updated_at = ?
     where id = ? and workspace_id = ?`
  ).run(now, "active", now, trackedPageId, workspaceId);
}

function seedSignals(workspaceId: string) {
  const signals: SignalSeed[] = [
    {
      title: "Submagic is pushing API automation",
      summary:
        "Submagic is making API automation visible on its homepage and API page, which points to a developer and agency workflow expansion.",
      impactScore: 78,
      priority: "Act now",
      meaning:
        "This is more than a feature note: Submagic is trying to own automated video production for teams that want to create clips at scale.",
      recommendedMove:
        "Decide whether your product needs an API response, or sharpen positioning around a simpler workflow for teams that do not want to build automation.",
      counterMoves: {
        defensive:
          "Protect your current users with messaging around speed, quality, and ease without requiring API setup.",
        offensive:
          "Target agencies and marketing teams that need high-volume shorts but prefer a ready-to-use workflow over developer integration.",
        ignore:
          "Ignore this if your near-term wedge is only individual creators and API automation is outside your ICP."
      },
      evidence: [
        {
          source: "Submagic homepage",
          detail:
            "Homepage banner promotes the Submagic API and automating the video editing workflow.",
          url: "https://www.submagic.co/"
        },
        {
          source: "Submagic API page",
          detail:
            "API page describes programmatic captions, project creation, webhooks, and scalable video processing.",
          url: "https://www.submagic.co/api"
        }
      ]
    },
    {
      title: "Submagic packages teams around Business + API",
      summary:
        "Submagic pricing has a Business + API plan and API credit packs, making team-scale video production a clear monetization path.",
      impactScore: 68,
      priority: "Watch",
      meaning:
        "The pricing motion suggests Submagic wants to move beyond individual creators into teams, agencies, and businesses with recurring video needs.",
      recommendedMove:
        "Compare your packaging against Submagic's team plan and prepare a sales talk track for where your product is simpler, cheaper, or more focused.",
      counterMoves: {
        defensive:
          "Make your own team value clear: collaboration, brand control, output quality, or faster time to publish.",
        offensive:
          "Pitch teams that find Business + API pricing or setup too heavy for their current volume.",
        ignore:
          "Ignore this if your current buyer is not comparing team plans or API minutes."
      },
      evidence: [
        {
          source: "Submagic pricing",
          detail:
            "Pricing page lists Business + API, 100 videos, 30 minute videos, 4K export, templates, brand assets, and API integrations.",
          url: "https://www.submagic.co/pricing"
        },
        {
          source: "Submagic pricing",
          detail:
            "Pricing page lists API credit packs for additional API minutes after plan purchase.",
          url: "https://www.submagic.co/pricing"
        }
      ]
    }
  ];

  let created = 0;

  const createSignal = db.transaction((signal: SignalSeed) => {
    const existing = db
      .prepare(
        "select id from signals where workspace_id = ? and competitor = ? and title = ? limit 1"
      )
      .get(workspaceId, "Submagic", signal.title) as IdRow | undefined;

    if (existing) {
      return false;
    }

    const signalId = randomUUID();

    db.prepare(
      `insert into signals (
        id, workspace_id, competitor, title, summary, impact_score, priority,
        detected_at, meaning, recommended_move, counter_moves_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      signalId,
      workspaceId,
      "Submagic",
      signal.title,
      signal.summary,
      signal.impactScore,
      signal.priority,
      now,
      signal.meaning,
      signal.recommendedMove,
      JSON.stringify(signal.counterMoves)
    );

    for (const evidence of signal.evidence) {
      db.prepare(
        `insert into evidence_sources (
          id, workspace_id, signal_id, source, detail, freshness, url
        ) values (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        workspaceId,
        signalId,
        evidence.source,
        evidence.detail,
        now,
        evidence.url
      );
    }

    return true;
  });

  for (const signal of signals) {
    if (createSignal(signal)) {
      created += 1;
    }
  }

  return created;
}

function ensureSeedActivity(workspaceId: string, createdSignals: number) {
  const label = "Seed Submagic tracking";
  const evidence = `Submagic competitor, tracked pages, baselines, and ${createdSignals} new seed signal${createdSignals === 1 ? "" : "s"} saved.`;
  const existing = db
    .prepare(
      "select id from agent_activities where workspace_id = ? and label = ? and source = ? limit 1"
    )
    .get(workspaceId, label, "Seed script") as IdRow | undefined;

  if (existing) {
    return;
  }

  db.prepare(
    `insert into agent_activities (
      id, workspace_id, label, source, status, evidence
    ) values (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), workspaceId, label, "Seed script", "Done", evidence);
}

async function hydratePageSeed(page: TrackedPageSeed): Promise<TrackedPageSeed> {
  try {
    const response = await fetch(page.url, {
      headers: {
        accept: "text/html, text/plain;q=0.9, */*;q=0.5",
        "user-agent": "CounterOSSeed/0.1 (+https://counteros.local)"
      },
      signal: AbortSignal.timeout(12_000)
    });

    if (!response.ok) {
      return page;
    }

    const html = await response.text();
    const extractedText = extractReadableText(html);

    return {
      ...page,
      title: extractTitle(html) ?? page.title,
      extractedText: extractedText.length >= 80 ? extractedText : page.extractedText
    };
  } catch {
    return page;
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(stripTags(match[1]).trim()).slice(0, 240) : null;
}

function extractReadableText(html: string) {
  return decodeEntities(
    stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    )
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40_000);
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

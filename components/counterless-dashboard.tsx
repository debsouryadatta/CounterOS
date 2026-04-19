"use client";

import { FormEvent, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import type {
  AgentActivity,
  ActivityStatus,
  Artifact,
  ChatMessage,
  CompetitorProfile,
  CurrentUser,
  DashboardData,
  Signal,
  SuggestedCompetitor,
  ThreatType
} from "@/lib/types";

type View = "overview" | "competitors" | "signals" | "moves" | "agent";

const views: Array<{ id: View; label: string; icon: IconName }> = [
  { id: "overview", label: "Overview", icon: "pulse" },
  { id: "competitors", label: "Competitors", icon: "target" },
  { id: "signals", label: "Signals", icon: "signal" },
  { id: "moves", label: "Counter-Moves", icon: "move" },
  { id: "agent", label: "Agent Chat", icon: "chat" }
];

export function CounterlessDashboard({
  initialData,
  user
}: {
  initialData: DashboardData;
  user: CurrentUser;
}) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [suggestions, setSuggestions] =
    useState<SuggestedCompetitor[]>(initialData.suggestedCompetitors);
  const [competitors, setCompetitors] =
    useState<CompetitorProfile[]>(initialData.approvedCompetitors);
  const [selectedSignalId, setSelectedSignalId] = useState(
    initialData.signals[0]?.id ?? ""
  );
  const [manualCompetitor, setManualCompetitor] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialData.messages);
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialData.artifacts);
  const [activities, setActivities] = useState<AgentActivity[]>(initialData.agentActivities);
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const pendingSuggestions = suggestions.filter(
    (suggestion) => suggestion.status === "pending"
  );
  const rejectedSuggestions = suggestions.filter((suggestion) =>
    ["rejected", "ignored", "snoozed", "verified"].includes(suggestion.status)
  );
  const selectedSignal = useMemo(
    () =>
      initialData.signals.find((signal) => signal.id === selectedSignalId) ??
      initialData.signals[0],
    [initialData.signals, selectedSignalId]
  );
  const actNowCount = initialData.signals.filter(
    (signal) => signal.priority === "Act now"
  ).length;
  const averageImpact = Math.round(
    initialData.signals.reduce((total, signal) => total + signal.impactScore, 0) /
      Math.max(initialData.signals.length, 1)
  );

  async function approveSuggestion(suggestion: SuggestedCompetitor) {
    await decideSuggestion(suggestion.id, "approved");
  }

  async function rejectSuggestion(id: string) {
    await decideSuggestion(id, "rejected");
  }

  async function decideSuggestion(
    id: string,
    decision: "approved" | "rejected" | "verified" | "ignored" | "snoozed"
  ) {
    setNotice("");
    setIsBusy(true);

    try {
      const response = await fetch(`/api/suggested-competitors/${id}/decision`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ decision })
      });

      if (!response.ok) {
        setNotice("Could not save that decision. Please try again.");
        return;
      }

      const payload = (await response.json()) as {
        suggestion: SuggestedCompetitor;
        competitor?: CompetitorProfile | null;
      };

      setSuggestions((current) =>
        current.map((item) =>
          item.id === payload.suggestion.id ? payload.suggestion : item
        )
      );

      if (payload.competitor) {
        setCompetitors((current) => {
          if (current.some((competitor) => competitor.id === payload.competitor?.id)) {
            return current;
          }

          return [payload.competitor, ...current].filter(Boolean) as CompetitorProfile[];
        });
      }

      setNotice(
        decision === "approved"
          ? "Approved, saved, and enrichment was attempted server-side."
          : "Decision saved to the decision log."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function addManualCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = manualCompetitor.trim();
    if (!value) {
      return;
    }

    setNotice("");
    setIsBusy(true);

    try {
      const response = await fetch("/api/suggested-competitors", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ value })
      });

      if (!response.ok) {
        setNotice("Could not add that competitor. Please try again.");
        return;
      }

      const payload = (await response.json()) as {
        suggestion: SuggestedCompetitor;
      };

      setSuggestions((current) => [payload.suggestion, ...current]);
      setManualCompetitor("");
      setNotice("Competitor suggestion saved to SQLite.");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = chatInput.trim();
    if (!text) {
      return;
    }

    setChatInput("");

    const optimisticMessage: ChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      text
    };

    setMessages((current) => [...current, optimisticMessage]);

    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      setNotice("Could not save that message. Please try again.");
      return;
    }

    const payload = (await response.json()) as {
      messages: ChatMessage[];
      suggestedCompetitors?: SuggestedCompetitor[];
      artifact?: Artifact | null;
      activities?: AgentActivity[];
    };

    setMessages((current) => [
      ...current.filter((message) => message.id !== optimisticMessage.id),
      ...payload.messages
    ]);
    if (payload.suggestedCompetitors?.length) {
      setSuggestions((current) => [...payload.suggestedCompetitors!, ...current]);
    }
    if (payload.artifact) {
      setArtifacts((current) => [payload.artifact!, ...current]);
    }
    if (payload.activities?.length) {
      setActivities((current) => [...current, ...payload.activities!]);
    }
  }

  async function enrichCompetitor(id: string) {
    setNotice("");
    setIsBusy(true);

    try {
      const response = await fetch(`/api/competitors/${id}/enrich`, {
        method: "POST"
      });

      if (!response.ok) {
        setNotice("Could not enrich that competitor. Please try again.");
        return;
      }

      const payload = (await response.json()) as { competitor: CompetitorProfile };
      setCompetitors((current) =>
        current.map((competitor) =>
          competitor.id === payload.competitor.id ? payload.competitor : competitor
        )
      );
      setNotice("Crustdata enrichment finished.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!selectedSignal) {
    return null;
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Icon name="move" />
          </div>
          <div>
            <p className="eyebrow">Competitor intelligence agent</p>
            <h1>Counterless</h1>
          </div>
        </div>

        <div className="topbar-actions" aria-label="Workspace status">
          <StatusPill tone="green" label="SQLite active" />
          <StatusPill tone="blue" label="Crustdata server-side" />
          <StatusPill tone="blue" label="OpenAI chat wired" />
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <Icon name="settings" />
            <span>{user.email}</span>
          </button>
        </div>
      </header>

      {notice && <div className="notice-bar">{notice}</div>}

      <div className="workspace-shell">
        <aside className="sidebar" aria-label="Counterless views">
          <nav className="nav-list">
            {views.map((view) => (
              <button
                key={view.id}
                className={activeView === view.id ? "nav-item active" : "nav-item"}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                <Icon name={view.icon} />
                <span>{view.label}</span>
              </button>
            ))}
          </nav>

          <section className="profile-strip" aria-label="Current product profile">
            <p className="section-kicker">Workspace</p>
            <h2>{initialData.productProfile.name}</h2>
            <p>{initialData.productProfile.description}</p>
            <dl>
              <div>
                <dt>ICP</dt>
                <dd>{initialData.productProfile.icp}</dd>
              </div>
              <div>
                <dt>Wedge</dt>
                <dd>{initialData.productProfile.wedge}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <main className="main-panel">
          {activeView === "overview" && (
            <OverviewView
              competitors={competitors}
              pendingCount={pendingSuggestions.length}
              actNowCount={actNowCount}
              averageImpact={averageImpact}
              selectedSignal={selectedSignal}
              setActiveView={setActiveView}
              activities={activities}
            />
          )}

          {activeView === "competitors" && (
            <CompetitorsView
              competitors={competitors}
              pendingSuggestions={pendingSuggestions}
              rejectedSuggestions={rejectedSuggestions}
              manualCompetitor={manualCompetitor}
              isBusy={isBusy}
              setManualCompetitor={setManualCompetitor}
              addManualCompetitor={addManualCompetitor}
              approveSuggestion={approveSuggestion}
              rejectSuggestion={rejectSuggestion}
              decideSuggestion={decideSuggestion}
              enrichCompetitor={enrichCompetitor}
            />
          )}

          {activeView === "signals" && (
            <SignalsView
              selectedSignal={selectedSignal}
              selectedSignalId={selectedSignalId}
              signals={initialData.signals}
              setSelectedSignalId={setSelectedSignalId}
            />
          )}

          {activeView === "moves" && (
            <MovesView selectedSignal={selectedSignal} artifacts={artifacts} />
          )}

          {activeView === "agent" && (
            <AgentView
              messages={messages}
              chatInput={chatInput}
              activities={activities}
              setChatInput={setChatInput}
              sendMessage={sendMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function OverviewView({
  competitors,
  pendingCount,
  actNowCount,
  averageImpact,
  selectedSignal,
  setActiveView,
  activities
}: {
  competitors: CompetitorProfile[];
  pendingCount: number;
  actNowCount: number;
  averageImpact: number;
  selectedSignal: Signal;
  setActiveView: (view: View) => void;
  activities?: AgentActivity[];
}) {
  return (
    <section className="view-stack" aria-labelledby="overview-title">
      <div className="briefing-band">
        <div>
          <p className="section-kicker">Founder briefing</p>
          <h2 id="overview-title">One signal needs a counter-move this week.</h2>
          <p>
            {selectedSignal.competitor} appears to be moving upmarket. Counterless
            recommends defending the small-clinic wedge before sales conversations
            drift toward enterprise comparisons.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setActiveView("moves")}>
          <Icon name="move" />
          <span>Open move</span>
        </button>
      </div>

      <div className="metric-grid">
        <MetricTile label="Tracked competitors" value={competitors.length.toString()} detail="approved profiles" />
        <MetricTile label="Pending approvals" value={pendingCount.toString()} detail="waiting for founder review" />
        <MetricTile label="Act now signals" value={actNowCount.toString()} detail="recommend response this week" />
        <MetricTile label="Average impact" value={`${averageImpact}`} detail="across active signals" />
      </div>

      <div className="content-grid two-column">
        <section className="panel">
          <PanelHeader
            kicker="Signal"
            title={selectedSignal.title}
            actionLabel="Review evidence"
            onAction={() => setActiveView("signals")}
          />
          <ImpactMeter score={selectedSignal.impactScore} priority={selectedSignal.priority} />
          <p className="body-copy">{selectedSignal.meaning}</p>
          <div className="evidence-list compact">
            {selectedSignal.evidence.slice(0, 2).map((evidence) => (
              <EvidenceRow key={`${evidence.source}-${evidence.detail}`} evidence={evidence} />
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader
            kicker="Agent activity"
            title="Visible work trail"
            actionLabel="Open chat"
            onAction={() => setActiveView("agent")}
          />
          <ActivityStream activities={activities ?? []} />
        </section>
      </div>
    </section>
  );
}

function CompetitorsView({
  competitors,
  pendingSuggestions,
  rejectedSuggestions,
  manualCompetitor,
  isBusy,
  setManualCompetitor,
  addManualCompetitor,
  approveSuggestion,
  rejectSuggestion,
  decideSuggestion,
  enrichCompetitor
}: {
  competitors: CompetitorProfile[];
  pendingSuggestions: SuggestedCompetitor[];
  rejectedSuggestions: SuggestedCompetitor[];
  manualCompetitor: string;
  isBusy: boolean;
  setManualCompetitor: (value: string) => void;
  addManualCompetitor: (event: FormEvent<HTMLFormElement>) => void;
  approveSuggestion: (suggestion: SuggestedCompetitor) => Promise<void>;
  rejectSuggestion: (id: string) => Promise<void>;
  decideSuggestion: (
    id: string,
    decision: "approved" | "rejected" | "verified" | "ignored" | "snoozed"
  ) => Promise<void>;
  enrichCompetitor: (id: string) => Promise<void>;
}) {
  return (
    <section className="view-stack" aria-labelledby="competitors-title">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Competitors</p>
          <h2 id="competitors-title">Review suggestions before tracking starts.</h2>
        </div>
        <form className="inline-form" onSubmit={addManualCompetitor}>
          <label className="sr-only" htmlFor="manual-competitor">
            Add competitor domain
          </label>
          <input
            id="manual-competitor"
            type="text"
            value={manualCompetitor}
            onChange={(event) => setManualCompetitor(event.target.value)}
            placeholder="competitor.com"
          />
          <button className="secondary-button" type="submit" disabled={isBusy}>
            <Icon name="plus" />
            <span>Add</span>
          </button>
        </form>
      </div>

      <section className="panel">
        <PanelHeader kicker="Approval queue" title={`${pendingSuggestions.length} pending suggestions`} />
        <div className="suggestion-grid">
          {pendingSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApprove={() => approveSuggestion(suggestion)}
              onReject={() => rejectSuggestion(suggestion.id)}
              onVerify={() => decideSuggestion(suggestion.id, "verified")}
              onIgnore={() => decideSuggestion(suggestion.id, "ignored")}
              onSnooze={() => decideSuggestion(suggestion.id, "snoozed")}
            />
          ))}
          {pendingSuggestions.length === 0 && (
            <EmptyState
              title="No pending suggestions"
              detail="Approved or rejected suggestions are now persisted in the SQLite decision log."
            />
          )}
        </div>
      </section>

      <section className="panel">
        <PanelHeader kicker="Tracking" title={`${competitors.length} approved competitors`} />
        <div className="competitor-grid">
          {competitors.map((competitor) => (
            <CompetitorCard
              key={competitor.id}
              competitor={competitor}
              onEnrich={() => enrichCompetitor(competitor.id)}
            />
          ))}
        </div>
      </section>

      {rejectedSuggestions.length > 0 && (
        <section className="panel muted-panel">
          <PanelHeader kicker="Decision log" title={`${rejectedSuggestions.length} rejected suggestion`} />
          <div className="mini-list">
            {rejectedSuggestions.map((suggestion) => (
              <span key={suggestion.id}>{suggestion.name}</span>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function SignalsView({
  selectedSignal,
  selectedSignalId,
  signals,
  setSelectedSignalId
}: {
  selectedSignal: Signal;
  selectedSignalId: string;
  signals: Signal[];
  setSelectedSignalId: (id: string) => void;
}) {
  return (
    <section className="view-stack" aria-labelledby="signals-title">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Signals</p>
          <h2 id="signals-title">Important changes with evidence attached.</h2>
        </div>
      </div>

      <div className="content-grid signal-layout">
        <section className="signal-list" aria-label="Signal list">
          {signals.map((signal) => (
            <button
              key={signal.id}
              className={selectedSignalId === signal.id ? "signal-card active" : "signal-card"}
              type="button"
              onClick={() => setSelectedSignalId(signal.id)}
            >
              <span className="signal-card-top">
                <span>{signal.competitor}</span>
                <StatusPill tone={toneForPriority(signal.priority)} label={signal.priority} />
              </span>
              <strong>{signal.title}</strong>
              <span>{signal.summary}</span>
            </button>
          ))}
        </section>

        <section className="panel signal-detail">
          <PanelHeader kicker={selectedSignal.competitor} title={selectedSignal.title} />
          <ImpactMeter score={selectedSignal.impactScore} priority={selectedSignal.priority} />
          <div className="analysis-block">
            <h3>Meaning</h3>
            <p>{selectedSignal.meaning}</p>
          </div>
          <div className="analysis-block">
            <h3>Recommended move</h3>
            <p>{selectedSignal.recommendedMove}</p>
          </div>
          <div className="evidence-list">
            {selectedSignal.evidence.map((evidence) => (
              <EvidenceRow key={`${evidence.source}-${evidence.detail}`} evidence={evidence} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function MovesView({
  selectedSignal,
  artifacts
}: {
  selectedSignal: Signal;
  artifacts: Artifact[];
}) {
  return (
    <section className="view-stack" aria-labelledby="moves-title">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Counter-moves</p>
          <h2 id="moves-title">Turn the signal into a founder decision.</h2>
        </div>
      </div>

      <section className="panel">
        <PanelHeader kicker="Recommended response" title={selectedSignal.title} />
        <div className="move-grid">
          <MoveOption title="Defensive" icon="shield" text={selectedSignal.counterMoves.defensive} />
          <MoveOption title="Offensive" icon="target" text={selectedSignal.counterMoves.offensive} />
          <MoveOption title="Ignore" icon="pause" text={selectedSignal.counterMoves.ignore} />
        </div>
      </section>

      <section className="panel">
        <PanelHeader kicker="Artifacts" title="Founder-ready outputs" />
        <div className="artifact-grid">
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="artifact-card">
              <div className="artifact-header">
                <StatusPill tone="green" label={artifact.type} />
                <button className="icon-button subtle" type="button" aria-label={`Open ${artifact.title}`}>
                  <Icon name="arrow" />
                </button>
              </div>
              <h3>{artifact.title}</h3>
              <p>{artifact.summary}</p>
              <ul>
                {artifact.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function AgentView({
  messages,
  chatInput,
  activities,
  setChatInput,
  sendMessage
}: {
  messages: ChatMessage[];
  chatInput: string;
  activities: AgentActivity[];
  setChatInput: (value: string) => void;
  sendMessage: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="view-stack" aria-labelledby="agent-title">
      <div className="view-heading">
        <div>
          <p className="section-kicker">Agent Chat</p>
          <h2 id="agent-title">The agent controls the same workflow as the UI.</h2>
        </div>
      </div>

      <div className="content-grid chat-layout">
        <section className="panel chat-panel">
          <div className="chat-messages" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`chat-bubble ${message.role}`}>
                <span>{message.role === "agent" ? "Counterless" : "You"}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-input">
              Message Counterless
            </label>
            <input
              id="chat-input"
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask Counterless to find competitors or explain a signal"
            />
            <button className="primary-button" type="submit">
              <Icon name="send" />
              <span>Send</span>
            </button>
          </form>
        </section>

        <section className="panel">
          <PanelHeader kicker="Activity stream" title="Agent work trail" />
          <ActivityStream activities={activities} />
        </section>
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PanelHeader({
  kicker,
  title,
  actionLabel,
  onAction
}: {
  kicker: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-header">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {actionLabel && onAction && (
        <button className="text-button" type="button" onClick={onAction}>
          <span>{actionLabel}</span>
          <Icon name="arrow" />
        </button>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  onVerify,
  onIgnore,
  onSnooze
}: {
  suggestion: SuggestedCompetitor;
  onApprove: () => void;
  onReject: () => void;
  onVerify: () => void;
  onIgnore: () => void;
  onSnooze: () => void;
}) {
  return (
    <article className="suggestion-card">
      <div className="card-title-row">
        <div>
          <h3>{suggestion.name}</h3>
          <p>{suggestion.domain}</p>
        </div>
        <ConfidenceBadge value={suggestion.confidence} />
      </div>
      <p>{suggestion.description}</p>
      <div className="tag-row">
        <StatusPill tone={toneForThreat(suggestion.threatType)} label={suggestion.threatType} />
        <StatusPill tone="amber" label={`${suggestion.priority} priority`} />
        <StatusPill
          tone={toneForIntelligence(suggestion.intelligenceStatus)}
          label={formatIntelligenceStatus(suggestion.intelligenceStatus)}
        />
      </div>
      {suggestion.identifyError && <p className="inline-error">{suggestion.identifyError}</p>}
      <ul className="evidence-points">
        {suggestion.evidence.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={onApprove}>
          <Icon name="check" />
          <span>Approve</span>
        </button>
        <button className="secondary-button" type="button" onClick={onReject}>
          <Icon name="x" />
          <span>Reject</span>
        </button>
        <button className="secondary-button" type="button" onClick={onVerify}>
          <Icon name="doc" />
          <span>Verify</span>
        </button>
        <button className="secondary-button" type="button" onClick={onSnooze}>
          <Icon name="pause" />
          <span>Snooze</span>
        </button>
        <button className="secondary-button" type="button" onClick={onIgnore}>
          <Icon name="x" />
          <span>Ignore</span>
        </button>
      </div>
    </article>
  );
}

function CompetitorCard({
  competitor,
  onEnrich
}: {
  competitor: CompetitorProfile;
  onEnrich: () => void;
}) {
  return (
    <article className="competitor-card">
      <div className="card-title-row">
        <div>
          <h3>{competitor.name}</h3>
          <p>{competitor.domain}</p>
        </div>
        <StatusPill tone={toneForThreat(competitor.threatType)} label={competitor.threatType} />
      </div>
      <div className="tag-row">
        <StatusPill
          tone={toneForIntelligence(competitor.intelligenceStatus)}
          label={formatIntelligenceStatus(competitor.intelligenceStatus)}
        />
        {competitor.crustdataCompanyId && (
          <StatusPill tone="blue" label="Crustdata linked" />
        )}
      </div>
      <p>{competitor.positioning}</p>
      <dl className="profile-facts">
        <div>
          <dt>Headcount</dt>
          <dd>{competitor.headcount}</dd>
        </div>
        <div>
          <dt>Hiring</dt>
          <dd>{competitor.hiring}</dd>
        </div>
        <div>
          <dt>Funding</dt>
          <dd>{competitor.funding}</dd>
        </div>
      </dl>
      {competitor.enrichmentError && <p className="inline-error">{competitor.enrichmentError}</p>}
      <button className="secondary-button" type="button" onClick={onEnrich}>
        <Icon name="pulse" />
        <span>Enrich</span>
      </button>
    </article>
  );
}

function ImpactMeter({ score, priority }: { score: number; priority: Signal["priority"] }) {
  return (
    <div className="impact-meter" aria-label={`Impact score ${score}`}>
      <div className="impact-label">
        <span>Impact score</span>
        <strong>{score}</strong>
      </div>
      <div className="impact-track">
        <span style={{ width: `${score}%` }} />
      </div>
      <StatusPill tone={toneForPriority(priority)} label={priority} />
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: Signal["evidence"][number] }) {
  return (
    <article className="evidence-row">
      <div className="source-icon" aria-hidden="true">
        <Icon name="doc" />
      </div>
      <div>
        <div>
          <strong>{evidence.source}</strong>
          <span>{evidence.freshness}</span>
        </div>
        <p>{evidence.detail}</p>
      </div>
    </article>
  );
}

function MoveOption({
  title,
  icon,
  text
}: {
  title: string;
  icon: IconName;
  text: string;
}) {
  return (
    <article className="move-option">
      <div className="move-icon" aria-hidden="true">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ActivityStream({ activities }: { activities: AgentActivity[] }) {
  return (
    <div className="activity-list">
      {activities.map((activity) => (
        <article key={activity.id} className="activity-row">
          <span className={`activity-dot ${statusClass(activity.status)}`} aria-hidden="true" />
          <div>
            <div>
              <strong>{activity.label}</strong>
              <StatusPill tone={toneForActivity(activity.status)} label={activity.status} />
            </div>
            <p>
              {activity.source}: {activity.evidence}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Icon name="check" />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <div className="confidence-badge" aria-label={`Confidence ${value} percent`}>
      <span>{value}%</span>
      <small>confidence</small>
    </div>
  );
}

function StatusPill({
  tone,
  label
}: {
  tone: "green" | "amber" | "red" | "blue" | "neutral";
  label: string;
}) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function toneForThreat(threatType: ThreatType): "green" | "amber" | "red" | "blue" | "neutral" {
  if (threatType === "Direct") return "red";
  if (threatType === "Enterprise") return "blue";
  if (threatType === "Emerging") return "amber";
  if (threatType === "Substitute") return "neutral";
  return "green";
}

function toneForPriority(priority: Signal["priority"]): "green" | "amber" | "red" | "blue" | "neutral" {
  if (priority === "Act now") return "red";
  if (priority === "Verify") return "blue";
  if (priority === "Watch") return "amber";
  return "neutral";
}

function toneForActivity(status: ActivityStatus): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "Done") return "green";
  if (status === "Running") return "blue";
  if (status === "Needs approval") return "amber";
  return "neutral";
}

function toneForIntelligence(
  status: SuggestedCompetitor["intelligenceStatus"]
): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "enriched" || status === "resolved") return "green";
  if (status === "resolving" || status === "enriching") return "blue";
  if (status === "failed") return "red";
  if (status === "no_match") return "amber";
  return "neutral";
}

function formatIntelligenceStatus(status: SuggestedCompetitor["intelligenceStatus"]) {
  return status.replace(/_/g, " ");
}

function statusClass(status: ActivityStatus) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

type IconName =
  | "arrow"
  | "chat"
  | "check"
  | "doc"
  | "move"
  | "pause"
  | "plus"
  | "pulse"
  | "send"
  | "settings"
  | "shield"
  | "signal"
  | "target"
  | "x";

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: IconName) {
  switch (name) {
    case "arrow":
      return <path d="M5 12h12m-5-5 5 5-5 5" />;
    case "chat":
      return <path d="M5 6h14v9H9l-4 3V6Z" />;
    case "check":
      return <path d="m5 12 4 4L19 6" />;
    case "doc":
      return <path d="M7 4h7l3 3v13H7V4Zm7 0v4h4M9 12h6M9 16h6" />;
    case "move":
      return <path d="M12 3v18M3 12h18m-5-5 5 5-5 5M8 7l-5 5 5 5" />;
    case "pause":
      return <path d="M8 6v12M16 6v12" />;
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "pulse":
      return <path d="M3 12h4l3-7 4 14 3-7h4" />;
    case "send":
      return <path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13" />;
    case "settings":
      return <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />;
    case "shield":
      return <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />;
    case "signal":
      return <path d="M4 18h2m4 0h2V8h-2v10Zm6 0h2V4h-2v14Z" />;
    case "target":
      return <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />;
    case "x":
      return <path d="m6 6 12 12M18 6 6 18" />;
  }
}

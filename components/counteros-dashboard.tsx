"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, type ChatStatus, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellDot,
  Bot,
  Check,
  Clock3,
  Command,
  Database,
  FileText,
  Gauge,
  Globe2,
  Layers3,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Pause,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCircle,
  type LucideIcon,
  X,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  AgentActivity,
  AgentToolOutput,
  ActivityStatus,
  Artifact,
  CompetitorProfile,
  CurrentUser,
  DashboardData,
  PageSnapshot,
  Signal,
  SuggestedCompetitor,
  TrackedPage,
  ThreatType
} from "@/lib/types";

type View = "overview" | "competitors" | "signals" | "moves" | "agent";

type BadgeTone = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "muted";

const views: Array<{
  id: View;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Founder briefing",
    icon: Activity
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Queue and tracking",
    icon: Target
  },
  {
    id: "signals",
    label: "Signals",
    description: "Evidence review",
    icon: Radar
  },
  {
    id: "moves",
    label: "Counter-moves",
    description: "Response options",
    icon: Zap
  },
  {
    id: "agent",
    label: "Agent chat",
    description: "Operator trail",
    icon: MessageSquare
  }
];

function upsertById<TItem extends { id: string }>(items: TItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

type AgentToolPart = {
  type: string;
  toolName: string;
  toolCallId?: string;
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function toUIChatMessages(messages: DashboardData["messages"]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role === "agent" ? "assistant" : "user",
    parts: [{ type: "text", text: message.text }]
  }));
}

function asToolPart(part: UIMessage["parts"][number]): AgentToolPart | null {
  const candidate = part as Partial<AgentToolPart>;

  if (typeof candidate.type !== "string" || !candidate.type.startsWith("tool-")) {
    return null;
  }

  return {
    ...candidate,
    type: candidate.type,
    toolName: candidate.toolName ?? candidate.type.replace(/^tool-/, ""),
    state: candidate.state ?? "input-available"
  };
}

function isAgentToolOutput(output: unknown): output is AgentToolOutput {
  if (!output || typeof output !== "object") {
    return false;
  }

  const candidate = output as Partial<AgentToolOutput>;

  return typeof candidate.ok === "boolean" && typeof candidate.summary === "string";
}

function labelForTool(toolName: string) {
  const labels: Record<string, string> = {
    approveSuggestion: "Approve suggestion",
    rejectSuggestion: "Reject suggestion",
    discoverCompetitors: "Fetch provider discovery",
    saveCompetitorSuggestion: "Save competitor suggestion",
    saveArtifact: "Save artifact",
    trackPage: "Track page",
    snapshotTrackedPage: "Snapshot tracked page"
  };

  return labels[toolName] ?? toolName.replace(/([A-Z])/g, " $1").trim();
}

function statusForToolPart(part: AgentToolPart): ActivityStatus {
  if (part.state === "output-error" || part.state === "output-denied") {
    return "Needs approval";
  }

  if (part.state === "output-available") {
    return isAgentToolOutput(part.output) && !part.output.ok ? "Needs approval" : "Done";
  }

  if (part.state === "approval-requested") {
    return "Needs approval";
  }

  return part.state === "input-streaming" ? "Queued" : "Running";
}

function detailForToolPart(part: AgentToolPart, output: AgentToolOutput | null) {
  if (output) {
    return output.summary;
  }

  if (part.errorText) {
    return part.errorText;
  }

  if (part.state === "input-streaming") {
    return "Preparing the tool call arguments.";
  }

  if (part.state === "approval-requested") {
    return "Waiting for approval before this tool can run.";
  }

  return `Running with ${formatToolInput(part.input)}.`;
}

function formatToolInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return "workspace context";
  }

  const value = input as Record<string, unknown>;
  const primary =
    value.target ?? value.query ?? value.url ?? value.value ?? value.title ?? value.trackedPageId;

  return typeof primary === "string" && primary.trim()
    ? primary.trim()
    : "workspace context";
}

function outputBadges(output: AgentToolOutput) {
  return [
    output.suggestedCompetitors?.length
      ? `${output.suggestedCompetitors.length} suggestions`
      : "",
    output.suggestionUpdates?.length ? `${output.suggestionUpdates.length} updates` : "",
    output.approvedCompetitors?.length
      ? `${output.approvedCompetitors.length} approved`
      : "",
    output.artifact ? "1 artifact" : "",
    output.trackedPages?.length ? `${output.trackedPages.length} tracked` : "",
    output.snapshots?.length ? `${output.snapshots.length} snapshots` : "",
    output.signals?.length ? `${output.signals.length} signals` : ""
  ].filter(Boolean);
}

function isVisibleMessagePart(part: UIMessage["parts"][number], showStepStart: boolean) {
  if (part.type === "text") {
    return part.text.trim().length > 0;
  }

  if (part.type === "step-start") {
    return showStepStart;
  }

  return Boolean(asToolPart(part));
}

export function CounterOSDashboard({
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
  const [signals, setSignals] = useState<Signal[]>(initialData.signals);
  const [trackedPages, setTrackedPages] =
    useState<TrackedPage[]>(initialData.trackedPages);
  const [selectedSignalId, setSelectedSignalId] = useState(
    initialData.signals[0]?.id ?? ""
  );
  const [manualCompetitor, setManualCompetitor] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialData.artifacts);
  const [activities, setActivities] =
    useState<AgentActivity[]>(initialData.agentActivities);
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  const initialChatMessages = useMemo(
    () => toUIChatMessages(initialData.messages),
    [initialData.messages]
  );
  const chatTransport = useMemo(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat/messages" }),
    []
  );
  const seenToolResultIds = useRef(new Set<string>());
  const {
    messages: chatMessages,
    status: chatStatus,
    sendMessage: sendChatMessage,
    error: chatError
  } = useChat<UIMessage>({
    messages: initialChatMessages,
    transport: chatTransport,
    onError: (error) => {
      setNotice(error.message || "The agent could not complete that request.");
    }
  });
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isChatBusy = chatStatus === "submitted" || chatStatus === "streaming";

  function mergeSignals(createdSignals: Signal[]) {
    if (createdSignals.length === 0) {
      return;
    }

    setSignals((current) => {
      const next = upsertById([...createdSignals, ...current]).sort(
        (left, right) => right.impactScore - left.impactScore
      );

      setSelectedSignalId((currentSelected) => currentSelected || next[0]?.id || "");
      return next;
    });
  }

  const pendingSuggestions = suggestions.filter(
    (suggestion) => suggestion.status === "pending"
  );
  const reviewedSuggestions = suggestions.filter((suggestion) =>
    ["rejected", "ignored", "snoozed", "verified"].includes(suggestion.status)
  );
  const selectedSignal = useMemo(
    () =>
      signals.find((signal) => signal.id === selectedSignalId) ??
      signals[0],
    [signals, selectedSignalId]
  );
  const actNowCount = signals.filter(
    (signal) => signal.priority === "Act now"
  ).length;
  const averageImpact = Math.round(
    signals.reduce((total, signal) => total + signal.impactScore, 0) /
      Math.max(signals.length, 1)
  );

  useEffect(() => {
    const outputs: AgentToolOutput[] = [];

    for (const message of chatMessages) {
      message.parts.forEach((part, index) => {
        const toolPart = asToolPart(part);

        if (!toolPart || toolPart.state !== "output-available") {
          return;
        }

        const resultId = toolPart.toolCallId || `${message.id}-${index}`;

        if (seenToolResultIds.current.has(resultId)) {
          return;
        }

        if (isAgentToolOutput(toolPart.output)) {
          seenToolResultIds.current.add(resultId);
          outputs.push(toolPart.output);
        }
      });
    }

    if (outputs.length === 0) {
      return;
    }

    const suggestedCompetitors = outputs.flatMap(
      (output) => output.suggestedCompetitors ?? []
    );
    const suggestionUpdates = outputs.flatMap(
      (output) => output.suggestionUpdates ?? []
    );
    const approvedCompetitors = outputs.flatMap(
      (output) => output.approvedCompetitors ?? []
    );
    const createdArtifacts = outputs.flatMap((output) =>
      output.artifact ? [output.artifact] : []
    );
    const createdActivities = outputs.flatMap((output) => output.activities ?? []);
    const createdTrackedPages = outputs.flatMap((output) => output.trackedPages ?? []);
    const createdSignals = outputs.flatMap((output) => output.signals ?? []);

    if (suggestedCompetitors.length) {
      setSuggestions((current) => upsertById([...suggestedCompetitors, ...current]));
    }
    if (suggestionUpdates.length) {
      setSuggestions((current) => upsertById([...suggestionUpdates, ...current]));
    }
    if (approvedCompetitors.length) {
      setCompetitors((current) => upsertById([...approvedCompetitors, ...current]));
    }
    if (createdArtifacts.length) {
      setArtifacts((current) => upsertById([...createdArtifacts, ...current]));
    }
    if (createdActivities.length) {
      setActivities((current) => upsertById([...current, ...createdActivities]));
    }
    if (createdTrackedPages.length) {
      setTrackedPages((current) => upsertById([...createdTrackedPages, ...current]));
    }
    if (createdSignals.length) {
      setSignals((current) => {
        const next = upsertById([...createdSignals, ...current]);
        setSelectedSignalId((currentSelected) => currentSelected || next[0]?.id || "");
        return next;
      });
    }
  }, [chatMessages]);

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
          ? "Competitor approved. Enrichment was queued server-side."
          : "Decision saved to the review log."
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
      setNotice("Competitor suggestion saved.");
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
    setNotice("");

    try {
      await sendChatMessage({ text });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The agent could not complete that request."
      );
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

  async function generateHiringSignals() {
    setNotice("");
    setIsBusy(true);

    try {
      const response = await fetch("/api/signals/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ limit: 25 })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        signals?: Signal[];
        error?: string;
      };

      if (!response.ok) {
        setNotice(payload.error ?? "Could not generate signals right now.");
        return;
      }

      const createdSignals = payload.signals ?? [];
      mergeSignals(createdSignals);
      setActiveView("signals");
      setNotice(
        createdSignals.length > 0
          ? `Created ${createdSignals.length} signal${createdSignals.length === 1 ? "" : "s"} from hiring evidence.`
          : "No hiring signals were created from the current competitor data."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function snapshotTrackedPages() {
    const pagesToSnapshot = trackedPages.filter((page) => page.status !== "paused");

    if (pagesToSnapshot.length === 0) {
      setNotice("Add a tracked page before running a page snapshot.");
      return;
    }

    setNotice("");
    setIsBusy(true);

    try {
      const createdSignals: Signal[] = [];
      let snapshotCount = 0;
      let failureCount = 0;

      for (const page of pagesToSnapshot) {
        const response = await fetch(`/api/tracked-pages/${page.id}/snapshot`, {
          method: "POST"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          snapshot?: PageSnapshot;
          signal?: Signal | null;
          error?: string;
        };

        if (!response.ok || !payload.snapshot) {
          failureCount += 1;
          setTrackedPages((current) =>
            current.map((trackedPage) =>
              trackedPage.id === page.id
                ? {
                    ...trackedPage,
                    status: "failed",
                    lastError: payload.error ?? "Snapshot failed."
                  }
                : trackedPage
            )
          );
          continue;
        }

        snapshotCount += 1;
        setTrackedPages((current) =>
          current.map((trackedPage) =>
            trackedPage.id === page.id
              ? {
                  ...trackedPage,
                  status: "active",
                  lastSnapshotAt: payload.snapshot?.fetchedAt ?? trackedPage.lastSnapshotAt,
                  lastError: null
                }
              : trackedPage
          )
        );

        if (payload.signal) {
          createdSignals.push(payload.signal);
        }
      }

      mergeSignals(createdSignals);
      setActiveView("signals");
      setNotice(
        `Snapshotted ${snapshotCount} page${snapshotCount === 1 ? "" : "s"}; created ${createdSignals.length} signal${createdSignals.length === 1 ? "" : "s"}${failureCount > 0 ? `; ${failureCount} failed` : ""}.`
      );
    } finally {
      setIsBusy(false);
    }
  }

  const workspaceTitle =
    initialData.productProfile?.name ?? initialData.workspace.name;

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#c5ccd3] p-8 text-foreground max-[900px]:p-0">
      <div className="mx-auto grid h-full min-h-0 max-w-[1780px] grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-[30px] bg-background shadow-[0_28px_80px_rgba(42,48,56,0.18)] max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-[auto_minmax(0,1fr)] max-[900px]:rounded-none">
        <aside className="flex min-h-0 flex-col overflow-y-auto bg-card px-8 py-9 max-[1100px]:px-5 max-[1100px]:py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(105,88,232,0.25)]">
              <Command className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="m-0 text-[22px] font-semibold tracking-tight">CounterOS</p>
              <p className="m-0 text-xs text-muted-foreground">Signal workspace</p>
            </div>
          </div>

          <nav className="mt-14 grid gap-2 max-[1100px]:mt-6 max-[1100px]:grid-cols-5 max-[720px]:grid-cols-2">
            {views.map((view) => {
              const Icon = view.icon;

              return (
                <button
                  key={view.id}
                  className={cn(
                    "group flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold transition-colors",
                    activeView === view.id
                      ? "bg-[#efedff] text-primary"
                      : "text-[#1d1c23] hover:bg-muted"
                  )}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                >
                  <Icon
                    className={cn(
                      "size-5 shrink-0",
                      activeView === view.id ? "text-primary" : "text-[#1d1c23]"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{view.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="mt-10 max-[1100px]:hidden">
            <p className="m-0 mb-4 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Workspace
            </p>
            <h2 className="m-0 text-lg font-semibold leading-snug">{workspaceTitle}</h2>
            <p className="m-0 mt-2 text-sm leading-6 text-muted-foreground">
              {initialData.productProfile?.description ??
                "Add context, approve competitors, and let signals collect into one clean feed."}
            </p>
            <dl className="mt-5 grid gap-4">
              <ReadinessRow
                label="Product profile"
                value={initialData.productProfile ? "Ready" : "Missing"}
                complete={Boolean(initialData.productProfile)}
              />
              <ReadinessRow
                label="Competitors"
                value={competitors.length.toString()}
                complete={competitors.length > 0}
              />
              <ReadinessRow
                label="Signals"
                value={signals.length.toString()}
                complete={signals.length > 0}
              />
            </dl>
          </section>

          <div className="mt-auto grid gap-2 pt-10 max-[1100px]:hidden">
            <button
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold hover:bg-muted"
              type="button"
              onClick={() => setIsAccountOpen((current) => !current)}
            >
              <Settings className="size-5" aria-hidden="true" />
              Account
            </button>
            <button
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold text-[#e05c43] hover:bg-[#fff0ed]"
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-5" aria-hidden="true" />
              Logout
            </button>
          </div>
        </aside>

        <div className="grid min-h-0 min-w-0 grid-rows-[96px_minmax(0,1fr)] max-[760px]:grid-rows-[auto_minmax(0,1fr)]">
          <header className="flex min-w-0 shrink-0 items-center justify-between gap-5 px-8 py-6 max-[760px]:grid max-[760px]:px-4">
            <div className="relative min-w-0 max-w-[900px] flex-1">
              <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="h-14 rounded-full border-[#dedfe8] bg-card pl-14 text-base shadow-sm"
                readOnly
                value=""
                placeholder="Search competitors, signals, pages..."
                aria-label="Search competitors, signals, pages"
              />
            </div>

            <div className="flex min-w-0 items-center justify-end gap-4 max-[760px]:justify-start">
              <button
                className="grid size-14 cursor-pointer place-items-center rounded-full border bg-card shadow-sm"
                type="button"
                aria-label="Open messages"
              >
                <Mail className="size-5" aria-hidden="true" />
              </button>
              <button
                className="grid size-14 cursor-pointer place-items-center rounded-full border bg-card shadow-sm"
                type="button"
                aria-label="Open notifications"
              >
                <BellDot className="size-5" aria-hidden="true" />
              </button>
              <div className="h-10 w-px bg-border max-[760px]:hidden" />
              <button
                className="flex min-w-0 cursor-pointer items-center gap-3 rounded-full px-2 py-1.5 hover:bg-muted"
                type="button"
                aria-expanded={isAccountOpen}
                onClick={() => setIsAccountOpen((current) => !current)}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e8e4f2] text-primary">
                  <UserCircle className="size-7" aria-hidden="true" />
                </span>
                <span className="min-w-0 max-w-[190px] truncate text-lg font-medium">
                  {user.name || user.email}
                </span>
              </button>
            </div>
          </header>

          <main className="min-h-0 overflow-y-auto overscroll-contain px-8 pb-8 max-[760px]:px-4">
            {notice && (
              <div className="mb-5 flex items-start gap-3 rounded-[22px] bg-[#efedff] px-5 py-4 text-sm text-primary">
                <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{notice}</span>
              </div>
            )}

            {activeView === "overview" && (
              <OverviewView
                competitors={competitors}
                pendingCount={pendingSuggestions.length}
                actNowCount={actNowCount}
                averageImpact={averageImpact}
                selectedSignal={selectedSignal}
              hasProductProfile={Boolean(initialData.productProfile)}
              workspaceTitle={workspaceTitle}
              userName={user.name || user.email}
              setActiveView={setActiveView}
              activities={activities}
            />
            )}

            {activeView === "competitors" && (
              <CompetitorsView
                competitors={competitors}
                pendingSuggestions={pendingSuggestions}
                reviewedSuggestions={reviewedSuggestions}
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
                signals={signals}
                trackedPages={trackedPages}
                isBusy={isBusy}
                setSelectedSignalId={setSelectedSignalId}
                generateHiringSignals={generateHiringSignals}
                snapshotTrackedPages={snapshotTrackedPages}
              />
            )}

            {activeView === "moves" && (
              <MovesView selectedSignal={selectedSignal} artifacts={artifacts} />
            )}

            {activeView === "agent" && (
              <AgentView
                messages={chatMessages}
                chatInput={chatInput}
                activities={activities}
                suggestions={pendingSuggestions}
                artifacts={artifacts}
                trackedPages={trackedPages}
                status={chatStatus}
                error={chatError}
                isBusy={isChatBusy}
                setChatInput={setChatInput}
                sendMessage={sendMessage}
              />
            )}
          </main>
        </div>
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
  hasProductProfile,
  workspaceTitle,
  userName,
  setActiveView,
  activities
}: {
  competitors: CompetitorProfile[];
  pendingCount: number;
  actNowCount: number;
  averageImpact: number;
  selectedSignal?: Signal;
  hasProductProfile: boolean;
  workspaceTitle: string;
  userName: string;
  setActiveView: (view: View) => void;
  activities?: AgentActivity[];
}) {
  const briefingTitle = selectedSignal
    ? "Your next competitor move is ready to review."
    : hasProductProfile
      ? "Keep your competitor signals easy to act on."
      : "Set up your workspace and start tracking signals.";

  return (
    <section className="grid grid-cols-[minmax(0,1fr)_420px] gap-7 max-[1320px]:grid-cols-1" aria-labelledby="overview-title">
      <div className="min-w-0 space-y-7">
        <section className="relative min-h-[290px] overflow-hidden rounded-[28px] bg-primary p-8 text-primary-foreground shadow-[0_24px_45px_rgba(105,88,232,0.22)] max-[760px]:p-6">
          <div className="pointer-events-none absolute right-8 top-5 h-24 w-24 rounded-[28px] border border-white/10 bg-white/5 max-[760px]:hidden" />
          <div className="pointer-events-none absolute bottom-4 right-28 h-40 w-40 rounded-[36px] border border-white/10 bg-white/5 max-[760px]:hidden" />
          <p className="m-0 text-[13px] font-medium uppercase tracking-[0.42em] text-white/80">
            Online signals
          </p>
          <h1
            id="overview-title"
            className="m-0 mt-6 max-w-[820px] text-[44px] font-medium leading-[1.12] tracking-tight max-[760px]:text-[32px]"
          >
            {briefingTitle}
          </h1>
          <p className="m-0 mt-5 max-w-[680px] text-base leading-7 text-white/78">
            {selectedSignal
              ? `${selectedSignal.competitor} has a fresh scored change. Review it, then choose a counter-move.`
              : hasProductProfile
                ? "Approve competitors, watch important pages, and let evidence collect into a clean response workflow."
                : `${workspaceTitle} is ready. Add product context and approve competitors to unlock useful signals.`}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              className="h-12 rounded-full bg-[#111114] px-6 text-white hover:bg-[#1d1d22]"
              type="button"
              onClick={() => setActiveView(selectedSignal ? "moves" : "competitors")}
            >
              {selectedSignal ? "Open move" : "Start now"}
              <span className="grid size-8 place-items-center rounded-full bg-white text-[#111114]">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-6 max-[920px]:grid-cols-1">
          <LearningPill icon={Target} value={`${competitors.length}/8 tracked`} title="Competitors" tone="purple" />
          <LearningPill icon={Radar} value={`${pendingCount} pending`} title="Approvals" tone="pink" />
          <LearningPill icon={Gauge} value={`${averageImpact}/100 impact`} title="Signals" tone="blue" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[26px] font-semibold tracking-tight">Continue monitoring</h2>
          <div className="flex gap-3">
            <Button className="size-11 rounded-full bg-card" size="icon" variant="ghost" type="button">
              <ArrowRight className="size-4 rotate-180 text-primary" aria-hidden="true" />
            </Button>
            <Button className="size-11 rounded-full" size="icon" type="button" onClick={() => setActiveView("signals")}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1">
          <MonitorCard
            icon={Radar}
            tag="Priority signal"
            title={selectedSignal?.title ?? "No signal selected yet"}
            detail={selectedSignal?.summary ?? "Signals will appear after collection jobs write evidence."}
            value={selectedSignal ? `${selectedSignal.impactScore}%` : "0%"}
            onOpen={() => setActiveView("signals")}
          />
          <MonitorCard
            icon={Target}
            tag="Competitors"
            title={`${competitors.length} companies tracked`}
            detail="Review the queue, approve the right companies, and enrich their profiles."
            value={`${pendingCount}`}
            onOpen={() => setActiveView("competitors")}
          />
          <MonitorCard
            icon={Bot}
            tag="Agent"
            title="Ask for discovery"
            detail="The agent can discover competitors, track pages, and create artifacts."
            value={`${activities?.length ?? 0}`}
            onOpen={() => setActiveView("agent")}
          />
        </div>
      </div>

      <aside className="min-w-0 space-y-7">
        <section className="rounded-[28px] bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="m-0 text-[26px] font-semibold tracking-tight">Statistic</h2>
            <Button size="icon" variant="ghost" type="button" aria-label="Open statistics">
              <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-7 grid place-items-center">
            <div className="relative grid size-[190px] place-items-center rounded-full border-[10px] border-[#eeeaf8]">
              <div
                className="absolute inset-[-10px] rounded-full border-[10px] border-primary border-l-transparent border-b-transparent"
                aria-hidden="true"
              />
              <div className="grid size-[110px] place-items-center rounded-full bg-[#eee7f2]">
                <UserCircle className="size-16 text-[#3b3645]" aria-hidden="true" />
              </div>
              <span className="absolute right-2 top-5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
                {averageImpact || 0}%
              </span>
            </div>
          </div>
          <h3 className="m-0 mt-5 text-center text-[24px] font-semibold">
            Good Morning {userName.split("@")[0].split(" ")[0] || "Founder"}
          </h3>
          <p className="m-0 mt-1 text-center text-sm text-muted-foreground">
            Continue tracking to catch your next useful move.
          </p>
          <div className="mt-8 rounded-[24px] bg-[#f3f4f9] p-5">
            <div className="grid grid-cols-5 items-end gap-4">
              {[34, 48, 35, 60, 32].map((height, index) => (
                <div key={index} className="grid gap-3">
                  <div
                    className={cn(
                      "rounded-lg",
                      index === 1 || index === 3 ? "bg-primary" : "bg-[#d9d2fb]"
                    )}
                    style={{ height }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Competitors</span>
              <span>Signals</span>
              <span>Moves</span>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[24px] font-semibold tracking-tight">Agent work</h2>
            <Button className="size-11 rounded-full" size="icon" variant="outline" type="button" onClick={() => setActiveView("agent")}>
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <ActivityStream activities={activities ?? []} />
        </section>
      </aside>
    </section>
  );
}

function LearningPill({
  icon: Icon,
  value,
  title,
  tone
}: {
  icon: LucideIcon;
  value: string;
  title: string;
  tone: "purple" | "pink" | "blue";
}) {
  const toneClass = {
    purple: "bg-[#eeeaff] text-primary",
    pink: "bg-[#faeafb] text-[#be61c5]",
    blue: "bg-[#e9f7fb] text-[#5aa7c5]"
  }[tone];

  return (
    <article className="flex min-h-[92px] items-center gap-5 rounded-[24px] bg-card px-5 shadow-sm">
      <div className={cn("grid size-14 place-items-center rounded-full", toneClass)}>
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="m-0 text-base text-muted-foreground">{value}</p>
        <h3 className="m-0 mt-1 truncate text-[20px] font-semibold tracking-tight">{title}</h3>
      </div>
    </article>
  );
}

function MonitorCard({
  icon: Icon,
  tag,
  title,
  detail,
  value,
  onOpen
}: {
  icon: LucideIcon;
  tag: string;
  title: string;
  detail: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] bg-card shadow-sm">
      <div className="h-[150px] bg-[#d9dce3] p-5">
        <div className="ml-auto grid size-10 place-items-center rounded-full bg-black/22 text-white backdrop-blur-sm">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <div className="p-5">
        <Badge variant="secondary" className="mb-3 bg-[#efedff] text-primary">
          {tag}
        </Badge>
        <h3 className="m-0 min-h-[58px] text-[21px] font-semibold leading-tight tracking-tight">
          {title}
        </h3>
        <p className="m-0 mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-[68%] rounded-full bg-primary" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{value}</span>
          <Button className="size-10 rounded-full" size="icon" variant="outline" type="button" onClick={onOpen}>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function CompetitorsView({
  competitors,
  pendingSuggestions,
  reviewedSuggestions,
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
  reviewedSuggestions: SuggestedCompetitor[];
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
    <section className="space-y-5" aria-labelledby="competitors-title">
      <PageHeader
        kicker="Competitor operations"
        title="Review the queue, then enrich the companies worth tracking."
        description="Keep the workspace strict: only approved competitors become part of the signal scoring loop."
      >
        <form
          className="flex w-[min(100%,440px)] items-center gap-2 max-[640px]:grid"
          onSubmit={addManualCompetitor}
        >
          <label className="sr-only" htmlFor="manual-competitor">
            Add competitor domain
          </label>
          <Input
            id="manual-competitor"
            type="text"
            value={manualCompetitor}
            onChange={(event) => setManualCompetitor(event.target.value)}
            placeholder="competitor.com"
          />
          <Button type="submit" variant="outline" disabled={isBusy}>
            <Plus />
            Add
          </Button>
        </form>
      </PageHeader>

      <Card className="rounded-[28px] border-0 shadow-sm">
        <CardHeader>
          <SectionHeader
            kicker="Approval queue"
            title={`${pendingSuggestions.length} pending suggestions`}
          />
        </CardHeader>
        <CardContent>
          {pendingSuggestions.length === 0 ? (
            <EmptyState
              icon={Check}
              title="No pending suggestions"
              detail="Approved, ignored, and rejected suggestions are persisted in the decision log."
            />
          ) : (
            <div className="grid grid-cols-3 gap-3 max-[1320px]:grid-cols-2 max-[820px]:grid-cols-1">
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-0 shadow-sm">
        <CardHeader>
          <SectionHeader
            kicker="Tracking"
            title={`${competitors.length} approved competitors`}
          />
        </CardHeader>
        <CardContent>
          {competitors.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No approved competitors"
              detail="Approve API-discovered suggestions or add a competitor manually to start monitoring."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[minmax(220px,1.15fr)_minmax(160px,0.8fr)_minmax(180px,0.85fr)_auto] gap-4 bg-muted/70 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground max-[980px]:hidden">
                <span>Company</span>
                <span>Threat</span>
                <span>Coverage</span>
                <span>Action</span>
              </div>
              <div className="divide-y">
                {competitors.map((competitor) => (
                  <CompetitorRow
                    key={competitor.id}
                    competitor={competitor}
                    onEnrich={() => enrichCompetitor(competitor.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {reviewedSuggestions.length > 0 && (
        <Card className="rounded-[28px] border-0 shadow-sm">
          <CardHeader>
            <SectionHeader
              kicker="Decision log"
              title={`${reviewedSuggestions.length} reviewed suggestions`}
            />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {reviewedSuggestions.map((suggestion) => (
                <Badge key={suggestion.id} variant="outline" className="bg-background">
                  {suggestion.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function SignalsView({
  selectedSignal,
  selectedSignalId,
  signals,
  trackedPages,
  isBusy,
  setSelectedSignalId,
  generateHiringSignals,
  snapshotTrackedPages
}: {
  selectedSignal?: Signal;
  selectedSignalId: string;
  signals: Signal[];
  trackedPages: TrackedPage[];
  isBusy: boolean;
  setSelectedSignalId: (id: string) => void;
  generateHiringSignals: () => Promise<void>;
  snapshotTrackedPages: () => Promise<void>;
}) {
  return (
    <section className="space-y-5" aria-labelledby="signals-title">
      <PageHeader
        kicker="Signal intelligence"
        title="Evidence-backed changes that deserve a decision."
        description="Signals are scored from stored competitor, hiring, people, and page evidence."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy || trackedPages.length === 0}
            onClick={snapshotTrackedPages}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Snapshot pages
          </Button>
          <Button type="button" disabled={isBusy} onClick={generateHiringSignals}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Database />}
            Generate signals
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-[390px_minmax(0,1fr)] gap-5 max-[1180px]:grid-cols-1">
        <Card className="rounded-[28px] border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Signal queue</CardTitle>
            <CardDescription>{signals.length} scored items</CardDescription>
          </CardHeader>
          <CardContent>
            {signals.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="No signals yet"
                detail="Once collection jobs write evidence, the signal queue will show the most important changes first."
              />
            ) : (
              <div className="grid gap-2">
                {signals.map((signal) => (
                  <button
                    key={signal.id}
                    className={cn(
                      "grid w-full cursor-pointer gap-2 rounded-xl border p-4 text-left transition-colors",
                      selectedSignalId === signal.id
                        ? "border-primary/30 bg-accent"
                        : "bg-background hover:bg-muted/60"
                    )}
                    type="button"
                    onClick={() => setSelectedSignalId(signal.id)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {signal.competitor}
                      </span>
                      <StatusBadge tone={toneForPriority(signal.priority)} label={signal.priority} />
                    </span>
                    <strong className="text-sm font-semibold leading-snug">
                      {signal.title}
                    </strong>
                    <span className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {signal.summary}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 shadow-sm">
          <CardHeader>
            <SectionHeader
              kicker={selectedSignal?.competitor ?? "Evidence"}
              title={selectedSignal?.title ?? "Nothing selected"}
            />
          </CardHeader>
          <CardContent>
            {selectedSignal ? (
              <div className="grid gap-5">
                <ImpactMeter score={selectedSignal.impactScore} priority={selectedSignal.priority} />
                <AnalysisBlock title="Meaning" text={selectedSignal.meaning} />
                <AnalysisBlock title="Recommended move" text={selectedSignal.recommendedMove} />
                <div className="grid gap-3">
                  {selectedSignal.evidence.length > 0 ? (
                    selectedSignal.evidence.map((evidence) => (
                      <EvidenceRow
                        key={`${evidence.source}-${evidence.detail}`}
                        evidence={evidence}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={FileText}
                      title="No evidence attached"
                      detail="This signal exists, but no evidence rows were saved with it yet."
                    />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Radar}
                title="Waiting for API data"
                detail="Selecting a signal will reveal its evidence, meaning, and recommended move."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-0 shadow-sm">
        <CardHeader>
          <SectionHeader
            kicker="Tracked sources"
            title={`${trackedPages.length} page${trackedPages.length === 1 ? "" : "s"} being watched`}
          />
        </CardHeader>
        <CardContent>
          {trackedPages.length === 0 ? (
            <EmptyState
              icon={Globe2}
              title="No tracked pages"
              detail="Add competitor pages through chat or seed data, then snapshot them to catch meaningful changes."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
              {trackedPages.map((page) => (
                <TrackedPageCard key={page.id} page={page} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MovesView({
  selectedSignal,
  artifacts
}: {
  selectedSignal?: Signal;
  artifacts: Artifact[];
}) {
  return (
    <section className="space-y-5" aria-labelledby="moves-title">
      <PageHeader
        kicker="Counter-moves"
        title="Turn a market signal into a clear founder decision."
        description="Compare defensive, offensive, and ignore paths before the team commits time."
      />

      <Card className="rounded-[28px] border-0 shadow-sm">
        <CardHeader>
          <SectionHeader
            kicker="Recommended response"
            title={selectedSignal?.title ?? "No signal selected"}
          />
        </CardHeader>
        <CardContent>
          {selectedSignal ? (
            <div className="grid grid-cols-3 gap-3 max-[1120px]:grid-cols-1">
              <MoveOption
                title="Defensive"
                icon={ShieldCheck}
                text={selectedSignal.counterMoves.defensive}
              />
              <MoveOption
                title="Offensive"
                icon={Target}
                text={selectedSignal.counterMoves.offensive}
              />
              <MoveOption title="Ignore" icon={Pause} text={selectedSignal.counterMoves.ignore} />
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title="Counter-moves need a signal"
              detail="Once API jobs create a signal, CounterOS can turn it into defensive, offensive, and ignore options."
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-0 shadow-sm">
        <CardHeader>
          <SectionHeader kicker="Artifacts" title="Founder-ready outputs" />
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <EmptyState
              icon={Layers3}
              title="No artifacts yet"
              detail="Battlecards, positioning memos, and target-account lists will appear after the agent generates them."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
              {artifacts.map((artifact) => (
                <article key={artifact.id} className="rounded-xl border bg-background p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <StatusBadge tone="success" label={artifact.type} />
                    <Button size="icon" variant="ghost" type="button" aria-label={`Open ${artifact.title}`}>
                      <ArrowRight />
                    </Button>
                  </div>
                  <h3 className="m-0 text-lg font-semibold leading-snug">{artifact.title}</h3>
                  <p className="m-0 mt-2 text-sm leading-6 text-muted-foreground">
                    {artifact.summary}
                  </p>
                  <ul className="mt-4 grid gap-2 pl-4 text-sm leading-6 text-muted-foreground">
                    {artifact.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AgentView({
  messages,
  chatInput,
  activities,
  suggestions,
  artifacts,
  trackedPages,
  status,
  error,
  isBusy,
  setChatInput,
  sendMessage
}: {
  messages: UIMessage[];
  chatInput: string;
  activities: AgentActivity[];
  suggestions: SuggestedCompetitor[];
  artifacts: Artifact[];
  trackedPages: TrackedPage[];
  status: ChatStatus;
  error?: Error;
  isBusy: boolean;
  setChatInput: (value: string) => void;
  sendMessage: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleSuggestions = suggestions.slice(0, 3);
  const visibleArtifacts = artifacts.slice(0, 3);
  const visibleTrackedPages = trackedPages.slice(0, 3);
  const lastAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const hasOutputs =
    visibleSuggestions.length > 0 ||
    visibleArtifacts.length > 0 ||
    visibleTrackedPages.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, status]);

  return (
    <section className="space-y-5" aria-labelledby="agent-title">
      <PageHeader
        kicker="Agent chat"
        title="Ask the agent to run the workspace, step by step."
        description="The agent can approve or reject explicit suggestions, run provider discovery, track pages, snapshot pages, and draft the final response with the work trail visible."
      >
        <StatusBadge tone={isBusy ? "info" : "success"} label={isBusy ? "Running" : "Ready"} />
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] gap-5 max-[1180px]:grid-cols-1">
        <Card className="rounded-[28px] border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              Workspace operator
            </CardTitle>
            <CardDescription>Messages are stored with the workspace chat thread.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={scrollRef}
              className="grid max-h-[620px] min-h-[500px] content-start gap-3 overflow-y-auto overscroll-contain rounded-xl border bg-muted/30 p-4"
            >
              {messages.length === 0 && (
                <EmptyState
                  icon={MessageSquare}
                  title="No chat history"
                  detail="Ask the agent to find competitors, explain signals, or draft artifacts."
                />
              )}
              {messages.map((message) => (
                <AgentChatMessage
                  key={message.id}
                  message={message}
                  isActive={isBusy && message.id === lastAssistantMessageId}
                />
              ))}
              {status === "submitted" && <AgentPendingMessage />}
              {error && (
                <div className="w-[min(84%,680px)] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 shadow-sm max-[720px]:w-full">
                  {error.message}
                </div>
              )}
            </div>
            <form
              className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[720px]:grid-cols-1"
              onSubmit={sendMessage}
            >
              <label className="sr-only" htmlFor="chat-input">
                Message CounterOS
              </label>
              <Input
                id="chat-input"
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask CounterOS to discover competitors or explain a signal"
              />
              <Button type="submit" disabled={isBusy}>
                {isBusy ? <Loader2 className="animate-spin" /> : <Send />}
                {isBusy ? "Running" : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[28px] border-0 shadow-sm">
            <CardHeader>
              <SectionHeader kicker="Activity stream" title="Agent work trail" />
            </CardHeader>
            <CardContent>
              <ActivityStream activities={activities} />
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-0 shadow-sm">
            <CardHeader>
              <SectionHeader kicker="Agent outputs" title="Created or changed" />
            </CardHeader>
            <CardContent>
              {!hasOutputs ? (
                <EmptyState
                  icon={Layers3}
                  title="No agent outputs yet"
                  detail="Suggestions, artifacts, and tracked pages created by chat actions will appear here."
                />
              ) : (
                <div className="grid gap-4">
                  {visibleSuggestions.map((suggestion) => (
                    <OutputRow
                      key={suggestion.id}
                      icon={Target}
                      title={suggestion.name}
                      detail={suggestion.domain}
                      badge="Needs review"
                    />
                  ))}
                  {visibleArtifacts.map((artifact) => (
                    <OutputRow
                      key={artifact.id}
                      icon={FileText}
                      title={artifact.title}
                      detail={artifact.summary}
                      badge={artifact.type}
                    />
                  ))}
                  {visibleTrackedPages.map((trackedPage) => (
                    <OutputRow
                      key={trackedPage.id}
                      icon={Globe2}
                      title={trackedPage.url}
                      detail={`${trackedPage.pageType} page · ${trackedPage.status}`}
                      badge="Tracked"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AgentChatMessage({
  message,
  isActive
}: {
  message: UIMessage;
  isActive: boolean;
}) {
  const isUser = message.role === "user";
  const lastPartIndex = message.parts.length - 1;
  const hasVisibleContent = message.parts.some((part, index) =>
    isVisibleMessagePart(part, isActive && index === lastPartIndex)
  );

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-[min(84%,720px)] rounded-xl border px-4 py-3 shadow-sm max-[720px]:w-full",
        isUser ? "justify-self-end border-primary/20 bg-primary text-primary-foreground" : "bg-card"
      )}
    >
      <span
        className={cn(
          "mb-2 block text-xs font-semibold uppercase",
          isUser ? "text-primary-foreground/72" : "text-muted-foreground"
        )}
      >
        {isUser ? "You" : "CounterOS"}
      </span>
      <div className="grid gap-3">
        {message.parts.map((part, index) => (
          <AgentMessagePart
            key={`${message.id}-${index}`}
            part={part}
            isUser={isUser}
            showStepStart={isActive && index === lastPartIndex}
          />
        ))}
      </div>
    </div>
  );
}

function AgentMessagePart({
  part,
  isUser,
  showStepStart
}: {
  part: UIMessage["parts"][number];
  isUser: boolean;
  showStepStart: boolean;
}) {
  if (part.type === "text") {
    return <MarkdownContent text={part.text} isUser={isUser} />;
  }

  if (part.type === "step-start") {
    if (!showStepStart) {
      return null;
    }

    return (
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg border bg-background/80 px-3 py-2">
        <div className="grid size-7 place-items-center rounded-full border bg-card">
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <strong className="text-sm font-semibold">Thinking through the next step</strong>
            <StatusBadge tone="info" label="Thinking" />
          </div>
          <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
            Checking the latest tool results before deciding whether another action is needed.
          </p>
        </div>
      </div>
    );
  }

  const toolPart = asToolPart(part);

  if (toolPart) {
    return <AgentToolTrace part={toolPart} />;
  }

  return null;
}

function MarkdownContent({ text, isUser }: { text: string; isUser: boolean }) {
  const subtleText = isUser ? "text-primary-foreground/78" : "text-muted-foreground";
  const borderClass = isUser ? "border-primary-foreground/22" : "border-border";
  const mutedSurface = isUser ? "bg-primary-foreground/10" : "bg-muted/60";
  const linkClass = isUser
    ? "text-primary-foreground underline underline-offset-4"
    : "text-primary underline underline-offset-4";

  return (
    <div
      className={cn(
        "min-w-0 break-words text-sm leading-6",
        isUser ? "text-primary-foreground" : "text-foreground"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a className={linkClass} href={href} rel="noreferrer" target="_blank">
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="m-0 mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="m-0 mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={cn("m-0 mb-2 border-l-2 pl-3 last:mb-0", borderClass, subtleText)}>
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => (
            <code
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-[0.86em]",
                className ? "block whitespace-pre p-3" : mutedSurface
              )}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={cn(
                "m-0 mb-2 max-w-full overflow-x-auto rounded-lg p-0 last:mb-0",
                mutedSurface
              )}
            >
              {children}
            </pre>
          ),
          hr: () => <hr className={cn("my-3", borderClass)} />,
          h1: ({ children }) => <h1 className="m-0 mb-2 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="m-0 mb-2 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="m-0 mb-2 text-sm font-semibold">{children}</h3>,
          table: ({ children }) => (
            <div className="mb-2 max-w-full overflow-x-auto last:mb-0">
              <table className={cn("min-w-full border-collapse text-left text-xs", borderClass)}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className={cn("border px-2 py-1 font-semibold", borderClass, mutedSurface)}>
              {children}
            </th>
          ),
          td: ({ children }) => <td className={cn("border px-2 py-1", borderClass)}>{children}</td>
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function AgentPendingMessage() {
  return (
    <div className="w-[min(84%,720px)] rounded-xl border bg-card px-4 py-3 shadow-sm max-[720px]:w-full">
      <span className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
        CounterOS
      </span>
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg border bg-background/80 px-3 py-2">
        <div className="grid size-7 place-items-center rounded-full border bg-card">
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <strong className="text-sm font-semibold">Starting agent run</strong>
            <StatusBadge tone="info" label="Queued" />
          </div>
          <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
            Reading the message and preparing the workspace tools.
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentToolTrace({ part }: { part: AgentToolPart }) {
  const label = labelForTool(part.toolName);
  const output = isAgentToolOutput(part.output) ? part.output : null;
  const status = statusForToolPart(part);
  const detail = detailForToolPart(part, output);
  const badges = output ? outputBadges(output) : [];

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg border bg-background/80 px-3 py-2">
      <div className="grid size-7 place-items-center rounded-full border bg-card">
        {status === "Running" || status === "Queued" ? (
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        ) : status === "Needs approval" ? (
          <X className="size-3.5 text-amber-600" aria-hidden="true" />
        ) : (
          <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <strong className="text-sm font-semibold">{label}</strong>
          <StatusBadge tone={toneForActivity(status)} label={status} />
        </div>
        <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        {badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <StatusBadge key={badge} tone="info" label={badge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OutputRow({
  icon: Icon,
  title,
  detail,
  badge
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  badge: string;
}) {
  return (
    <article className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <strong className="min-w-0 truncate text-sm font-semibold">{title}</strong>
          <StatusBadge tone="info" label={badge} />
        </div>
        <p className="m-0 mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
    </article>
  );
}

function PageHeader({
  kicker,
  title,
  description,
  children
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex items-start justify-between gap-5 rounded-[28px] bg-card px-7 py-6 shadow-sm max-[820px]:grid max-[640px]:px-5">
      <div className="min-w-0">
        <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">{kicker}</p>
        <h1 className="m-0 mt-2 max-w-[900px] text-[30px] font-semibold leading-tight tracking-tight max-[640px]:text-[24px]">
          {title}
        </h1>
        <p className="m-0 mt-2 max-w-[780px] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children && <div className="shrink-0 max-[820px]:shrink">{children}</div>}
    </section>
  );
}

function SectionHeader({
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
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">{kicker}</p>
        <h2 className="m-0 mt-2 text-xl font-semibold leading-tight">{title}</h2>
      </div>
      {actionLabel && onAction && (
        <Button className="shrink-0" variant="ghost" type="button" onClick={onAction}>
          {actionLabel}
          <ArrowRight />
        </Button>
      )}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-[28px] border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </div>
        </div>
        <strong className="mt-5 block text-4xl font-semibold leading-none">{value}</strong>
        <p className="m-0 mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
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
    <article className="flex min-w-0 flex-col rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-lg font-semibold leading-snug">{suggestion.name}</h3>
          <p className="m-0 mt-1 truncate text-sm text-muted-foreground">{suggestion.domain}</p>
        </div>
        <ConfidenceBadge value={suggestion.confidence} />
      </div>
      <p className="m-0 mt-3 text-sm leading-6 text-muted-foreground">
        {suggestion.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone={toneForThreat(suggestion.threatType)} label={suggestion.threatType} />
        <StatusBadge tone="warning" label={`${suggestion.priority} priority`} />
        <StatusBadge
          tone={toneForIntelligence(suggestion.intelligenceStatus)}
          label={formatIntelligenceStatus(suggestion.intelligenceStatus)}
        />
      </div>
      {suggestion.identifyError && (
        <p className="m-0 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {suggestion.identifyError}
        </p>
      )}
      <ul className="mt-4 grid gap-2 pl-4 text-sm leading-6 text-muted-foreground">
        {suggestion.evidence.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={onApprove}>
          <Check />
          Approve
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onReject}>
          <X />
          Reject
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onVerify}>
          <FileText />
          Verify
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onSnooze}>
          <Pause />
          Snooze
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onIgnore}>
          Ignore
        </Button>
      </div>
    </article>
  );
}

function CompetitorRow({
  competitor,
  onEnrich
}: {
  competitor: CompetitorProfile;
  onEnrich: () => void;
}) {
  return (
    <article className="grid grid-cols-[minmax(220px,1.15fr)_minmax(160px,0.8fr)_minmax(180px,0.85fr)_auto] items-center gap-4 bg-background px-4 py-4 max-[980px]:grid-cols-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 truncate text-base font-semibold">{competitor.name}</h3>
          {competitor.crustdataCompanyId && <StatusBadge tone="info" label="Crustdata" />}
        </div>
        <p className="m-0 mt-1 truncate text-sm text-muted-foreground">{competitor.domain}</p>
        <p className="m-0 mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {competitor.positioning}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={toneForThreat(competitor.threatType)} label={competitor.threatType} />
        <StatusBadge
          tone={toneForIntelligence(competitor.intelligenceStatus)}
          label={formatIntelligenceStatus(competitor.intelligenceStatus)}
        />
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm max-[520px]:grid-cols-1">
        <Fact label="Headcount" value={competitor.headcount} />
        <Fact label="Hiring" value={competitor.hiring} />
        <Fact label="Funding" value={competitor.funding} />
      </dl>

      <div className="flex justify-end max-[980px]:justify-start">
        <Button variant="outline" type="button" onClick={onEnrich}>
          <RefreshCw />
          Enrich
        </Button>
      </div>

      {competitor.enrichmentError && (
        <p className="col-span-full m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {competitor.enrichmentError}
        </p>
      )}
    </article>
  );
}

function ImpactMeter({ score, priority }: { score: number; priority: Signal["priority"] }) {
  const normalizedScore = Math.max(0, Math.min(100, score));

  return (
    <div className="rounded-xl border bg-background p-4" aria-label={`Impact score ${score}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm text-muted-foreground">Impact score</p>
          <strong className="mt-1 block text-3xl font-semibold leading-none">{score}</strong>
        </div>
        <StatusBadge tone={toneForPriority(priority)} label={priority} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: Signal["evidence"][number] }) {
  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-xl border bg-background p-3">
      <div className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <strong className="min-w-0 truncate text-sm font-semibold">{evidence.source}</strong>
          <span className="shrink-0 text-xs font-medium text-primary">{evidence.freshness}</span>
        </div>
        <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">{evidence.detail}</p>
      </div>
    </article>
  );
}

function TrackedPageCard({ page }: { page: TrackedPage }) {
  const lastSnapshot = page.lastSnapshotAt
    ? page.lastSnapshotAt.replace("T", " ").slice(0, 16)
    : "No snapshot yet";

  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-xl border bg-background p-4">
      <div className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Globe2 className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <strong className="min-w-0 truncate text-sm font-semibold">{page.url}</strong>
          <StatusBadge tone={toneForTrackedPage(page.status)} label={page.status} />
        </div>
        <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
          {page.pageType} page · {lastSnapshot}
        </p>
        {page.lastError && (
          <p className="m-0 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {page.lastError}
          </p>
        )}
      </div>
    </article>
  );
}

function MoveOption({
  title,
  icon: Icon,
  text
}: {
  title: string;
  icon: LucideIcon;
  text: string;
}) {
  return (
    <article className="rounded-xl border bg-background p-5">
      <div className="mb-4 grid size-10 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <h3 className="m-0 text-lg font-semibold leading-snug">{title}</h3>
      <p className="m-0 mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

function ActivityStream({ activities }: { activities: AgentActivity[] }) {
  return (
    <div className="grid gap-4">
      {activities.length === 0 && (
        <EmptyState
          icon={Bot}
          title="No activity yet"
          detail="Agent activity will appear when API jobs or chat actions create work items."
        />
      )}
      {activities.map((activity) => (
        <article key={activity.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
          <div className="grid size-8 place-items-center rounded-full border bg-background">
            <span
              className={cn("size-2.5 rounded-full", activityDotClass(activity.status))}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 border-b pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <strong className="min-w-0 text-sm font-semibold">{activity.label}</strong>
              <StatusBadge tone={toneForActivity(activity.status)} label={activity.status} />
            </div>
            <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
              {activity.source}: {activity.evidence}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed bg-muted/30 p-6 text-center">
      <div>
        <div className="mx-auto grid size-11 place-items-center rounded-xl border bg-card text-primary shadow-sm">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <h3 className="m-0 mt-4 text-base font-semibold">{title}</h3>
        <p className="m-0 mt-2 max-w-[460px] text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  return (
    <div
      className="grid size-[64px] shrink-0 place-items-center rounded-xl border bg-muted/50"
      aria-label={`Confidence ${value} percent`}
    >
      <span className="text-lg font-semibold leading-none">{value}%</span>
      <small className="text-[11px] font-medium text-muted-foreground">match</small>
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  complete
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-1 flex items-center justify-between gap-3 text-sm">
        <span>{value}</span>
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full border",
            complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {complete ? <Check className="size-3" /> : <Clock3 className="size-3" />}
        </span>
      </dd>
    </div>
  );
}

function HealthRow({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: BadgeTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-3">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <StatusBadge tone={tone} label={value} />
    </div>
  );
}

function PipelineStep({
  label,
  detail,
  complete
}: {
  label: string;
  detail: string;
  complete: boolean;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
      <div
        className={cn(
          "grid size-8 place-items-center rounded-full border",
          complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
        )}
      >
        {complete ? <Check className="size-4" /> : <Clock3 className="size-4" />}
      </div>
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium">{label}</p>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function AnalysisBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <h3 className="m-0 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <p className="m-0 mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-1 text-sm">{value}</dd>
    </div>
  );
}

function StatusBadge({
  tone,
  label
}: {
  tone: BadgeTone;
  label: string;
}) {
  return (
    <Badge variant={tone} className="capitalize">
      {label}
    </Badge>
  );
}

function toneForThreat(threatType: ThreatType): BadgeTone {
  if (threatType === "Direct") return "destructive";
  if (threatType === "Enterprise") return "info";
  if (threatType === "Emerging") return "warning";
  if (threatType === "Substitute") return "muted";
  return "success";
}

function toneForPriority(priority: Signal["priority"]): BadgeTone {
  if (priority === "Act now") return "destructive";
  if (priority === "Verify") return "info";
  if (priority === "Watch") return "warning";
  return "muted";
}

function toneForActivity(status: ActivityStatus): BadgeTone {
  if (status === "Done") return "success";
  if (status === "Running") return "info";
  if (status === "Needs approval") return "warning";
  return "muted";
}

function toneForTrackedPage(status: TrackedPage["status"]): BadgeTone {
  if (status === "active") return "success";
  if (status === "failed") return "destructive";
  return "muted";
}

function toneForIntelligence(status: SuggestedCompetitor["intelligenceStatus"]): BadgeTone {
  if (status === "enriched" || status === "resolved") return "success";
  if (status === "resolving" || status === "enriching") return "info";
  if (status === "failed") return "destructive";
  if (status === "no_match") return "warning";
  return "muted";
}

function formatIntelligenceStatus(status: SuggestedCompetitor["intelligenceStatus"]) {
  return status.replace(/_/g, " ");
}

function activityDotClass(status: ActivityStatus) {
  if (status === "Done") return "bg-emerald-600";
  if (status === "Running") return "bg-sky-600";
  if (status === "Needs approval") return "bg-amber-600";
  return "bg-muted-foreground";
}

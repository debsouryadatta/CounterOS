"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, type ChatStatus, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  AlertTriangle,
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
  Trash2,
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
  ProductProfile,
  Signal,
  SuggestedCompetitor,
  TrackedPage,
  ThreatType
} from "@/lib/types";

type View = "overview" | "competitors" | "signals" | "moves" | "agent";

type BadgeTone = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "muted";
type ToastTone = "success" | "error" | "info" | "warning";

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

function emptyProductProfileDraft(): ProductProfile {
  return {
    name: "",
    description: "",
    icp: "",
    category: "",
    geography: "",
    wedge: ""
  };
}

function compactProductProfileDraft(profile: ProductProfile) {
  return Object.fromEntries(
    Object.entries(profile)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value)
  ) as Partial<ProductProfile>;
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
    reviewSuggestion: "Review suggestion",
    saveProductProfile: "Save product profile",
    discoverCompetitors: "Fetch provider discovery",
    saveCompetitorSuggestion: "Save competitor suggestion",
    enrichCompetitor: "Enrich competitor",
    removeCompetitor: "Remove competitor",
    saveArtifact: "Save artifact",
    trackPage: "Track page",
    snapshotTrackedPage: "Snapshot tracked page",
    snapshotTrackedPages: "Snapshot tracked pages",
    generateHiringSignals: "Generate hiring signals"
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
    output.productProfile ? "profile saved" : "",
    output.suggestedCompetitors?.length
      ? `${output.suggestedCompetitors.length} suggestions`
      : "",
    output.suggestionUpdates?.length ? `${output.suggestionUpdates.length} updates` : "",
    output.approvedCompetitors?.length
      ? `${output.approvedCompetitors.length} approved`
      : "",
    output.removedCompetitorIds?.length
      ? `${output.removedCompetitorIds.length} removed`
      : "",
    output.artifact ? "1 artifact" : "",
    output.trackedPages?.length ? `${output.trackedPages.length} tracked` : "",
    output.snapshots?.length ? `${output.snapshots.length} snapshots` : "",
    output.signals?.length ? `${output.signals.length} signals` : ""
  ].filter(Boolean);
}

function isRenderableMessagePart(part: UIMessage["parts"][number]) {
  if (part.type === "text") {
    return part.text.trim().length > 0;
  }

  return Boolean(asToolPart(part));
}

function hasRenderablePartsAfter(parts: UIMessage["parts"], index: number) {
  return parts.slice(index + 1).some(isRenderableMessagePart);
}

export function CounterOSDashboard({
  initialData,
  user
}: {
  initialData: DashboardData;
  user: CurrentUser;
}) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(
    initialData.productProfile
  );
  const [productDraft, setProductDraft] = useState<ProductProfile>(() =>
    emptyProductProfileDraft()
  );
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
    setMessages: setChatMessages,
    status: chatStatus,
    sendMessage: sendChatMessage,
    clearError: clearChatError,
    error: chatError
  } = useChat<UIMessage>({
    messages: initialChatMessages,
    transport: chatTransport,
    onError: (error) => {
      notify({
        tone: "error",
        title: "Agent request failed",
        description: error.message || "The agent could not complete that request."
      });
    }
  });
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingProductProfile, setIsSavingProductProfile] = useState(false);
  const [isProductProfileOpen, setIsProductProfileOpen] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isConfirmingClearChat, setIsConfirmingClearChat] = useState(false);
  const [enrichingCompetitorId, setEnrichingCompetitorId] = useState<string | null>(null);
  const [removingCompetitorId, setRemovingCompetitorId] = useState<string | null>(null);
  const [confirmRemoveCompetitorId, setConfirmRemoveCompetitorId] = useState<string | null>(null);
  const isChatBusy = chatStatus === "submitted" || chatStatus === "streaming";

  function notify(input: {
    tone: ToastTone;
    title: string;
    description?: string;
    notice?: string;
  }) {
    const noticeMessage = input.notice ?? input.description ?? input.title;
    const options = input.description ? { description: input.description } : undefined;

    setNotice(noticeMessage);

    if (input.tone === "success") {
      toast.success(input.title, options);
      return;
    }

    if (input.tone === "error") {
      toast.error(input.title, options);
      return;
    }

    if (input.tone === "warning") {
      toast.warning(input.title, options);
      return;
    }

    toast.info(input.title, options);
  }

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

    const productProfiles = outputs.flatMap((output) =>
      output.productProfile ? [output.productProfile] : []
    );
    const suggestedCompetitors = outputs.flatMap(
      (output) => output.suggestedCompetitors ?? []
    );
    const suggestionUpdates = outputs.flatMap(
      (output) => output.suggestionUpdates ?? []
    );
    const approvedCompetitors = outputs.flatMap(
      (output) => output.approvedCompetitors ?? []
    );
    const removedCompetitorIds = outputs.flatMap(
      (output) => output.removedCompetitorIds ?? []
    );
    const createdArtifacts = outputs.flatMap((output) =>
      output.artifact ? [output.artifact] : []
    );
    const createdActivities = outputs.flatMap((output) => output.activities ?? []);
    const createdTrackedPages = outputs.flatMap((output) => output.trackedPages ?? []);
    const createdSignals = outputs.flatMap((output) => output.signals ?? []);

    if (productProfiles.length) {
      setProductProfile(productProfiles[0]);
      setProductDraft(emptyProductProfileDraft());
    }
    if (suggestedCompetitors.length) {
      setSuggestions((current) => upsertById([...suggestedCompetitors, ...current]));
    }
    if (suggestionUpdates.length) {
      setSuggestions((current) => upsertById([...suggestionUpdates, ...current]));
    }
    if (approvedCompetitors.length) {
      setCompetitors((current) => upsertById([...approvedCompetitors, ...current]));
    }
    if (removedCompetitorIds.length) {
      const removed = new Set(removedCompetitorIds);
      setCompetitors((current) => current.filter((competitor) => !removed.has(competitor.id)));
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

  async function saveProductProfileDraft(options: { showSuccess?: boolean } = {}) {
    const payload = compactProductProfileDraft(productDraft);

    if (!payload.description && !productProfile?.description) {
      notify({
        tone: "warning",
        title: "Company description needed",
        description: "Add a short description of what you are building so AI can discover relevant competitors."
      });
      return null;
    }

    setNotice("");
    setIsSavingProductProfile(true);

    try {
      const response = await fetch("/api/product-profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => ({}))) as {
        productProfile?: ProductProfile;
        error?: string;
      };

      if (!response.ok || !result.productProfile) {
        notify({
          tone: "error",
          title: "Company profile not saved",
          description: result.error ?? "Could not save your company profile."
        });
        return null;
      }

      setProductProfile(result.productProfile);
      setProductDraft(emptyProductProfileDraft());
      setIsProductProfileOpen(false);

      if (options.showSuccess !== false) {
        notify({
          tone: "success",
          title: "Company profile saved",
          description: "CounterOS can now use this context for AI competitor discovery."
        });
      }

      return result.productProfile;
    } finally {
      setIsSavingProductProfile(false);
    }
  }

  async function saveProductProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProductProfileDraft();
  }

  async function discoverCompetitorsFromProfile() {
    let profile = productProfile;
    const payload = compactProductProfileDraft(productDraft);
    const hasDraftChanges = Object.entries(payload).some(
      ([key, value]) => productProfile?.[key as keyof ProductProfile] !== value
    );

    if (Object.keys(payload).length > 0 && (!profile || hasDraftChanges)) {
      profile = await saveProductProfileDraft({ showSuccess: false });
    }

    if (!profile?.description) {
      notify({
        tone: "warning",
        title: "Add your company first",
        description: "Save a short company description before asking AI to discover competitors."
      });
      return;
    }

    setNotice("");

    try {
      await sendChatMessage({
        text: `Using my saved company profile for ${profile.name}, discover 8 likely competitors with Crustdata and save them to the pending suggestions queue. Focus on this product context: ${profile.description}`
      });
      notify({
        tone: "info",
        title: "Agent discovery started",
        description: "The Agent will save matching companies into the approval queue."
      });
    } catch (error) {
      notify({
        tone: "error",
        title: "Discovery not started",
        description:
          error instanceof Error
            ? error.message
            : "The Agent could not start competitor discovery."
      });
    }
  }

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
        notify({
          tone: "error",
          title: "Decision not saved",
          description: "Could not save that decision. Please try again."
        });
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

      notify({
        tone: "success",
        title: decision === "approved" ? "Competitor approved" : "Decision saved",
        description:
          decision === "approved"
            ? "Enrichment was queued server-side."
            : "The review log has been updated."
      });
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
        notify({
          tone: "error",
          title: "Competitor not added",
          description: "Could not add that competitor. Please try again."
        });
        return;
      }

      const payload = (await response.json()) as {
        suggestion: SuggestedCompetitor;
      };

      setSuggestions((current) => [payload.suggestion, ...current]);
      setManualCompetitor("");
      notify({
        tone: "success",
        title: "Competitor suggestion saved",
        description: `${payload.suggestion.name} is waiting in the approval queue.`
      });
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
      notify({
        tone: "error",
        title: "Message not sent",
        description:
          error instanceof Error
            ? error.message
            : "The agent could not complete that request."
      });
    }
  }

  async function clearChat() {
    if (isChatBusy || isClearingChat || chatMessages.length === 0) {
      return;
    }

    setNotice("");
    setIsClearingChat(true);

    try {
      const response = await fetch("/api/chat/messages", {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        notify({
          tone: "error",
          title: "Chat not cleared",
          description: payload?.error ?? "Could not clear the chat history."
        });
        return;
      }

      setChatMessages([]);
      clearChatError();
      setChatInput("");
      setIsConfirmingClearChat(false);
      notify({
        tone: "success",
        title: "Chat cleared",
        description: "The agent chat history is empty now."
      });
    } catch (error) {
      notify({
        tone: "error",
        title: "Chat not cleared",
        description:
          error instanceof Error
            ? error.message
            : "Could not clear the chat history."
      });
    } finally {
      setIsClearingChat(false);
    }
  }

  async function enrichCompetitor(id: string) {
    setNotice("");
    setIsBusy(true);
    setEnrichingCompetitorId(id);

    try {
      const response = await fetch(`/api/competitors/${id}/enrich`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        competitor?: CompetitorProfile;
        error?: string;
      };

      if (payload.competitor) {
        setCompetitors((current) =>
          current.map((competitor) =>
            competitor.id === payload.competitor?.id ? payload.competitor : competitor
          )
        );
      }

      if (!response.ok) {
        notify({
          tone: "error",
          title: "Enrichment failed",
          description:
            payload.error ?? "Crustdata enrichment failed. The row was updated with the error."
        });
        return;
      }

      notify({
        tone: payload.competitor?.intelligenceStatus === "no_match" ? "warning" : "success",
        title:
          payload.competitor?.intelligenceStatus === "no_match"
            ? "No confident match"
            : "Enrichment finished",
        description:
          payload.competitor?.intelligenceStatus === "no_match"
            ? "Crustdata did not return a confident company match."
            : `${payload.competitor?.name ?? "Competitor"} profile is up to date.`
      });
    } finally {
      setIsBusy(false);
      setEnrichingCompetitorId(null);
    }
  }

  async function removeCompetitor(competitor: CompetitorProfile) {
    setNotice("");
    setIsBusy(true);
    setRemovingCompetitorId(competitor.id);

    try {
      const response = await fetch(`/api/competitors/${competitor.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        pausedTrackedPages?: number;
      };

      if (!response.ok) {
        notify({
          tone: "error",
          title: "Competitor not removed",
          description: payload.error ?? "Could not remove that competitor. Please try again."
        });
        return;
      }

      const pausedTrackedPages =
        payload.pausedTrackedPages ??
        trackedPages.filter((page) => page.competitorId === competitor.id).length;

      setCompetitors((current) =>
        current.filter((item) => item.id !== competitor.id)
      );
      setTrackedPages((current) =>
        current.map((page) =>
          page.competitorId === competitor.id
            ? {
                ...page,
                competitorId: null,
                status: "paused",
                lastError: null
              }
            : page
        )
      );
      setConfirmRemoveCompetitorId(null);
      notify({
        tone: "success",
        title: "Competitor removed",
        description: `${competitor.name} was removed from tracking${pausedTrackedPages > 0 ? `; ${pausedTrackedPages} linked page${pausedTrackedPages === 1 ? "" : "s"} paused.` : "."}`
      });
    } finally {
      setIsBusy(false);
      setRemovingCompetitorId(null);
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
        notify({
          tone: "error",
          title: "Signals not generated",
          description: payload.error ?? "Could not generate signals right now."
        });
        return;
      }

      const createdSignals = payload.signals ?? [];
      mergeSignals(createdSignals);
      setActiveView("signals");
      notify({
        tone: createdSignals.length > 0 ? "success" : "info",
        title: createdSignals.length > 0 ? "Signals generated" : "No new hiring signals",
        description:
          createdSignals.length > 0
            ? `Created ${createdSignals.length} signal${createdSignals.length === 1 ? "" : "s"} from hiring evidence.`
            : "No hiring signals were created from the current competitor data."
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function snapshotTrackedPages() {
    const pagesToSnapshot = trackedPages.filter((page) => page.status !== "paused");

    if (pagesToSnapshot.length === 0) {
      notify({
        tone: "warning",
        title: "No pages to snapshot",
        description: "Add a tracked page before running a page snapshot."
      });
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
      notify({
        tone: failureCount > 0 ? "warning" : createdSignals.length > 0 ? "success" : "info",
        title:
          failureCount > 0
            ? "Snapshot finished with errors"
            : createdSignals.length > 0
              ? "Page-change signals created"
              : "Snapshots saved",
        description: `Snapshotted ${snapshotCount} page${snapshotCount === 1 ? "" : "s"}; created ${createdSignals.length} signal${createdSignals.length === 1 ? "" : "s"}${failureCount > 0 ? `; ${failureCount} failed` : ""}.`
      });
    } finally {
      setIsBusy(false);
    }
  }

  const workspaceTitle = productProfile?.name ?? initialData.workspace.name;

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#c5ccd3] p-8 text-foreground max-[900px]:p-0">
      <div className="mx-auto grid h-full min-h-0 max-w-[1780px] grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-[30px] bg-background shadow-[0_28px_80px_rgba(42,48,56,0.18)] max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-[auto_minmax(0,1fr)] max-[900px]:rounded-none">
        <aside className="flex min-h-0 flex-col overflow-hidden bg-card px-8 py-9 max-[1100px]:px-5 max-[1100px]:py-5">
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
                    "group relative grid min-h-[58px] cursor-pointer grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[22px] px-3 py-2 text-left transition-all",
                    activeView === view.id
                      ? "bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(105,88,232,0.22)]"
                      : "text-[#1d1c23] hover:bg-muted"
                  )}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-2xl transition-colors",
                      activeView === view.id
                        ? "bg-white/18 text-primary-foreground"
                        : "bg-muted text-[#1d1c23] group-hover:bg-card"
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">
                      {view.label}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[11px] font-medium max-[1100px]:hidden",
                        activeView === view.id ? "text-primary-foreground/72" : "text-muted-foreground"
                      )}
                    >
                      {view.description}
                    </span>
                  </span>
                  {activeView === view.id && (
                    <span
                      className="absolute right-3 top-3 size-2 rounded-full bg-primary-foreground/80 max-[1100px]:hidden"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

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

          <main
            className={cn(
              "min-h-0 px-8 pb-8 max-[760px]:px-4",
              activeView === "agent"
                ? "flex flex-col gap-5 overflow-hidden"
                : "scrollbar-none overflow-y-auto overscroll-contain"
            )}
          >
            {notice && (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-[22px] bg-[#efedff] px-5 py-4 text-sm text-primary",
                  activeView === "agent" ? "shrink-0" : "mb-5"
                )}
              >
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
              hasProductProfile={Boolean(productProfile)}
              workspaceTitle={workspaceTitle}
              setActiveView={setActiveView}
              activities={activities}
            />
            )}

            {activeView === "competitors" && (
              <CompetitorsView
                productProfile={productProfile}
                productDraft={productDraft}
                competitors={competitors}
                pendingSuggestions={pendingSuggestions}
                reviewedSuggestions={reviewedSuggestions}
                manualCompetitor={manualCompetitor}
                isBusy={isBusy}
                isSavingProductProfile={isSavingProductProfile}
                isDiscoveringWithAgent={isChatBusy}
                isProductProfileOpen={isProductProfileOpen}
                setProductDraft={setProductDraft}
                setIsProductProfileOpen={setIsProductProfileOpen}
                enrichingCompetitorId={enrichingCompetitorId}
                removingCompetitorId={removingCompetitorId}
                confirmRemoveCompetitorId={confirmRemoveCompetitorId}
                setManualCompetitor={setManualCompetitor}
                setConfirmRemoveCompetitorId={setConfirmRemoveCompetitorId}
                saveProductProfile={saveProductProfile}
                discoverCompetitorsFromProfile={discoverCompetitorsFromProfile}
                addManualCompetitor={addManualCompetitor}
                approveSuggestion={approveSuggestion}
                rejectSuggestion={rejectSuggestion}
                decideSuggestion={decideSuggestion}
                enrichCompetitor={enrichCompetitor}
                removeCompetitor={removeCompetitor}
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
                productProfile={productProfile}
                messages={chatMessages}
                chatInput={chatInput}
                status={chatStatus}
                error={chatError}
                isBusy={isChatBusy}
                isClearingChat={isClearingChat}
                isConfirmingClearChat={isConfirmingClearChat}
                setChatInput={setChatInput}
                sendMessage={sendMessage}
                onRequestClearChat={() => setIsConfirmingClearChat(true)}
                onCancelClearChat={() => setIsConfirmingClearChat(false)}
                onConfirmClearChat={clearChat}
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
              onClick={() => setActiveView(selectedSignal ? "moves" : "agent")}
            >
              {selectedSignal ? "Open move" : "Talk to AI"}
              <span className="grid size-8 place-items-center rounded-full bg-white text-[#111114]">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-4 max-[920px]:grid-cols-1">
          <LearningPill icon={Target} value={`${competitors.length}/8 tracked`} title="Competitors" tone="purple" />
          <LearningPill icon={Radar} value={`${pendingCount} pending`} title="Approvals" tone="pink" />
          <LearningPill icon={Gauge} value={`${averageImpact}/100 impact`} title="Signals" tone="blue" />
        </div>

        <div className="flex items-end justify-between gap-4 max-[720px]:grid">
          <div>
            <h2 className="m-0 text-[26px] font-semibold tracking-tight">Continue monitoring</h2>
            <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
              The active queue, signal pressure, and AI work trail in one glance.
            </p>
          </div>
          <Button className="h-11 rounded-full bg-card" variant="outline" type="button" onClick={() => setActiveView("agent")}>
            <Bot className="size-4" aria-hidden="true" />
            Talk to AI
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-5 max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1">
          <MonitorCard
            icon={Radar}
            tone="violet"
            tag="Priority signal"
            title={selectedSignal?.title ?? "No signal selected yet"}
            detail={selectedSignal?.summary ?? "Signals will appear after collection jobs write evidence."}
            metric={selectedSignal ? `${selectedSignal.impactScore}/100` : "0/100"}
            metricLabel={`${actNowCount} act-now`}
            progress={selectedSignal?.impactScore ?? 0}
            actionLabel="Review"
            onOpen={() => setActiveView("signals")}
          />
          <MonitorCard
            icon={Target}
            tone="emerald"
            tag="Competitor queue"
            title={`${competitors.length} companies tracked`}
            detail="Review the queue, approve the right companies, and enrich their profiles."
            metric={`${competitors.length}/8`}
            metricLabel={`${pendingCount} pending`}
            progress={Math.min(100, (competitors.length / 8) * 100)}
            actionLabel="Open queue"
            onOpen={() => setActiveView("competitors")}
          />
          <MonitorCard
            icon={Bot}
            tone="amber"
            tag="Agent"
            title="AI operator is ready"
            detail="Use the agent to run discovery, approvals, tracking, snapshots, signal generation, and artifacts."
            metric={`${activities?.length ?? 0}`}
            metricLabel="workspace actions"
            progress={Math.min(100, (activities?.length ?? 0) * 18)}
            actionLabel="Talk to AI"
            onOpen={() => setActiveView("agent")}
          />
        </div>
      </div>

      <aside className="min-w-0 space-y-5">
        <AgentCommandCenter
          competitorCount={competitors.length}
          pendingCount={pendingCount}
          actNowCount={actNowCount}
          setActiveView={setActiveView}
        />

        <section className="rounded-[28px] bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[24px] font-semibold tracking-tight">Latest agent work</h2>
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

function AgentCommandCenter({
  competitorCount,
  pendingCount,
  actNowCount,
  setActiveView
}: {
  competitorCount: number;
  pendingCount: number;
  actNowCount: number;
  setActiveView: (view: View) => void;
}) {
  const capabilities = [
    {
      icon: Target,
      label: "Competitors",
      detail: "Discover, save, approve, enrich, remove"
    },
    {
      icon: Globe2,
      label: "Pages",
      detail: "Track URLs, snapshot pages, detect changes"
    },
    {
      icon: Radar,
      label: "Signals",
      detail: "Generate hiring signals and review evidence"
    },
    {
      icon: FileText,
      label: "Artifacts",
      detail: "Create battlecards, memos, target accounts"
    }
  ];

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#17161f] p-6 text-white shadow-[0_24px_55px_rgba(23,22,31,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-white text-primary">
          <Bot className="size-6" aria-hidden="true" />
        </div>
        <StatusBadge tone="success" label="Ready" />
      </div>
      <p className="m-0 mt-7 text-[13px] font-semibold uppercase tracking-[0.32em] text-white/60">
        AI operator
      </p>
      <h2 className="m-0 mt-3 text-[32px] font-semibold leading-tight tracking-tight">
        Talk to AI and run the workspace.
      </h2>
      <p className="m-0 mt-4 text-sm leading-6 text-white/68">
        The Agent can handle the full loop from product context to competitor discovery,
        page checks, signal creation, and saved response assets.
      </p>
      <Button
        className="mt-6 h-12 rounded-full bg-white px-5 text-[#17161f] hover:bg-white/90"
        type="button"
        onClick={() => setActiveView("agent")}
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        Talk to AI
      </Button>

      <ul className="m-0 mt-7 grid gap-0 p-0">
        {capabilities.map((item) => (
          <AgentCapability key={item.label} {...item} />
        ))}
      </ul>

      <div className="mt-7 grid grid-cols-3 border-t border-white/10 pt-5 text-center">
        <AgentStat value={competitorCount.toString()} label="Tracked" />
        <AgentStat value={pendingCount.toString()} label="Pending" />
        <AgentStat value={actNowCount.toString()} label="Act now" />
      </div>
    </section>
  );
}

function AgentCapability({
  icon: Icon,
  label,
  detail
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-semibold">{label}</strong>
        <span className="mt-1 block text-xs leading-5 text-white/58">{detail}</span>
      </span>
    </li>
  );
}

function AgentStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong className="block text-2xl font-semibold leading-none">{value}</strong>
      <span className="mt-1 block text-xs font-medium uppercase text-white/50">{label}</span>
    </div>
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
    <article className="grid min-h-[72px] grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-sm">
      <div className={cn("grid size-11 place-items-center rounded-full", toneClass)}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="m-0 truncate text-sm leading-5 text-muted-foreground">{value}</p>
        <h3 className="m-0 truncate text-[17px] font-semibold leading-6 tracking-tight">{title}</h3>
      </div>
    </article>
  );
}

function MonitorCard({
  icon: Icon,
  tone,
  tag,
  title,
  detail,
  metric,
  metricLabel,
  progress,
  actionLabel,
  onOpen
}: {
  icon: LucideIcon;
  tone: "violet" | "emerald" | "amber";
  tag: string;
  title: string;
  detail: string;
  metric: string;
  metricLabel: string;
  progress: number;
  actionLabel: string;
  onOpen: () => void;
}) {
  const toneClass = {
    violet: {
      icon: "bg-[#efedff] text-primary",
      badge: "bg-[#efedff] text-primary",
      metric: "bg-[#f5f2ff] text-primary",
      bar: "bg-primary"
    },
    emerald: {
      icon: "bg-[#eaf8f0] text-[#168553]",
      badge: "bg-[#eaf8f0] text-[#168553]",
      metric: "bg-[#f1fbf5] text-[#168553]",
      bar: "bg-[#1fa463]"
    },
    amber: {
      icon: "bg-[#fff4dc] text-[#b56b0f]",
      badge: "bg-[#fff4dc] text-[#b56b0f]",
      metric: "bg-[#fff8e9] text-[#b56b0f]",
      bar: "bg-[#e49a24]"
    }
  }[tone];
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <article className="group flex min-h-[232px] flex-col rounded-[22px] border border-white bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(42,48,56,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid size-10 place-items-center rounded-2xl", toneClass.icon)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <Badge variant="secondary" className={cn("max-w-[170px] truncate rounded-full", toneClass.badge)}>
          {tag}
        </Badge>
      </div>

      <h3 className="m-0 mt-5 line-clamp-2 min-h-[52px] text-[20px] font-semibold leading-[1.28] tracking-tight">
        {title}
      </h3>

      <p className="m-0 mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {detail}
      </p>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>{metricLabel}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", toneClass.metric)}>
            {metric}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", toneClass.bar)}
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {Math.round(normalizedProgress)}%
          </span>
          <Button className="h-9 rounded-full px-4 text-sm" variant="outline" type="button" onClick={onOpen}>
            {actionLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductProfilePanel({
  productProfile,
  productDraft,
  isSaving,
  isDiscovering,
  isOpen,
  setProductDraft,
  setIsOpen,
  onSave,
  onDiscover
}: {
  productProfile: ProductProfile | null;
  productDraft: ProductProfile;
  isSaving: boolean;
  isDiscovering: boolean;
  isOpen: boolean;
  setProductDraft: (profile: ProductProfile) => void;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDiscover: () => Promise<void>;
}) {
  const draftPayload = compactProductProfileDraft(productDraft);
  const hasDraftValues = Object.keys(draftPayload).length > 0;
  const hasDescription = Boolean(productDraft.description.trim() || productProfile?.description);
  const canSave = productProfile ? hasDraftValues : Boolean(productDraft.description.trim());

  function updateField(field: keyof ProductProfile, value: string) {
    setProductDraft({ ...productDraft, [field]: value });
  }

  return (
    <Card className="rounded-[22px] border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 max-[760px]:grid">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
              <Command className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">
                Your company
              </p>
              <h2 className="m-0 mt-1 truncate text-lg font-semibold leading-tight">
                {productProfile?.description
                  ? "Company context is saved."
                  : "Add company context for AI discovery."}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-[760px]:justify-start">
            <StatusBadge
              tone={productProfile?.description ? "success" : "warning"}
              label={productProfile?.description ? "Context saved" : "Needs description"}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving || isDiscovering || !hasDescription}
              onClick={onDiscover}
            >
              {isDiscovering ? <Loader2 className="animate-spin" /> : <Search />}
              {isDiscovering ? "Finding..." : "Find competitors"}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close company form" : "Open company form"}
              onClick={() => setIsOpen(!isOpen)}
            >
              <Plus className={cn("transition-transform", isOpen && "rotate-45")} />
            </Button>
          </div>
        </div>

        {isOpen && (
          <form className="mt-4 grid gap-5 border-t pt-4" onSubmit={onSave} autoComplete="off">
          <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-4 max-[980px]:grid-cols-1">
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Company or product</span>
                <Input
                  autoComplete="off"
                  value={productDraft.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Submagic"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Category</span>
                  <Input
                    autoComplete="off"
                    value={productDraft.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    placeholder="AI video editing"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Geography</span>
                  <Input
                    autoComplete="off"
                    value={productDraft.geography}
                    onChange={(event) => updateField("geography", event.target.value)}
                    placeholder="US, India, global"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Ideal customer</span>
                <Input
                  autoComplete="off"
                  value={productDraft.icp}
                  onChange={(event) => updateField("icp", event.target.value)}
                  placeholder="Creators, marketers, agencies"
                />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>What you are building</span>
                <textarea
                  className="min-h-[118px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground shadow-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
                  autoComplete="off"
                  value={productDraft.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="A product that helps teams create short-form videos with AI captions, hooks, templates, and workflow automation."
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Differentiator</span>
                <Input
                  autoComplete="off"
                  value={productDraft.wedge}
                  onChange={(event) => updateField("wedge", event.target.value)}
                  placeholder="Faster workflow, better automation, lower production cost"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isDiscovering || !hasDescription}
              onClick={onDiscover}
            >
              {isDiscovering ? <Loader2 className="animate-spin" /> : <Search />}
              {isDiscovering ? "Finding..." : "Find competitors with AI"}
            </Button>
            <Button type="submit" disabled={isSaving || !canSave}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
              {isSaving ? "Saving..." : "Save company"}
            </Button>
          </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitorsView({
  productProfile,
  productDraft,
  competitors,
  pendingSuggestions,
  reviewedSuggestions,
  manualCompetitor,
  isBusy,
  isSavingProductProfile,
  isDiscoveringWithAgent,
  isProductProfileOpen,
  setProductDraft,
  setIsProductProfileOpen,
  enrichingCompetitorId,
  removingCompetitorId,
  confirmRemoveCompetitorId,
  setManualCompetitor,
  setConfirmRemoveCompetitorId,
  saveProductProfile,
  discoverCompetitorsFromProfile,
  addManualCompetitor,
  approveSuggestion,
  rejectSuggestion,
  decideSuggestion,
  enrichCompetitor,
  removeCompetitor
}: {
  productProfile: ProductProfile | null;
  productDraft: ProductProfile;
  competitors: CompetitorProfile[];
  pendingSuggestions: SuggestedCompetitor[];
  reviewedSuggestions: SuggestedCompetitor[];
  manualCompetitor: string;
  isBusy: boolean;
  isSavingProductProfile: boolean;
  isDiscoveringWithAgent: boolean;
  isProductProfileOpen: boolean;
  setProductDraft: (profile: ProductProfile) => void;
  setIsProductProfileOpen: (isOpen: boolean) => void;
  enrichingCompetitorId: string | null;
  removingCompetitorId: string | null;
  confirmRemoveCompetitorId: string | null;
  setManualCompetitor: (value: string) => void;
  setConfirmRemoveCompetitorId: (id: string | null) => void;
  saveProductProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  discoverCompetitorsFromProfile: () => Promise<void>;
  addManualCompetitor: (event: FormEvent<HTMLFormElement>) => void;
  approveSuggestion: (suggestion: SuggestedCompetitor) => Promise<void>;
  rejectSuggestion: (id: string) => Promise<void>;
  decideSuggestion: (
    id: string,
    decision: "approved" | "rejected" | "verified" | "ignored" | "snoozed"
  ) => Promise<void>;
  enrichCompetitor: (id: string) => Promise<void>;
  removeCompetitor: (competitor: CompetitorProfile) => Promise<void>;
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

      <ProductProfilePanel
        productProfile={productProfile}
        productDraft={productDraft}
        isSaving={isSavingProductProfile}
        isDiscovering={isDiscoveringWithAgent}
        isOpen={isProductProfileOpen}
        setProductDraft={setProductDraft}
        setIsOpen={setIsProductProfileOpen}
        onSave={saveProductProfile}
        onDiscover={discoverCompetitorsFromProfile}
      />

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
                <span>Actions</span>
              </div>
              <div className="divide-y">
                {competitors.map((competitor) => (
                  <CompetitorRow
                    key={competitor.id}
                    competitor={competitor}
                    isBusy={isBusy}
                    isEnriching={enrichingCompetitorId === competitor.id}
                    isRemoving={removingCompetitorId === competitor.id}
                    isConfirmingRemove={confirmRemoveCompetitorId === competitor.id}
                    onEnrich={() => enrichCompetitor(competitor.id)}
                    onRequestRemove={() => setConfirmRemoveCompetitorId(competitor.id)}
                    onCancelRemove={() => setConfirmRemoveCompetitorId(null)}
                    onConfirmRemove={() => removeCompetitor(competitor)}
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
            Check page changes
          </Button>
          <Button type="button" disabled={isBusy} onClick={generateHiringSignals}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Database />}
            Check hiring signals
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
  productProfile,
  messages,
  chatInput,
  status,
  error,
  isBusy,
  isClearingChat,
  isConfirmingClearChat,
  setChatInput,
  sendMessage,
  onRequestClearChat,
  onCancelClearChat,
  onConfirmClearChat
}: {
  productProfile: ProductProfile | null;
  messages: UIMessage[];
  chatInput: string;
  status: ChatStatus;
  error?: Error;
  isBusy: boolean;
  isClearingChat: boolean;
  isConfirmingClearChat: boolean;
  setChatInput: (value: string) => void;
  sendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onRequestClearChat: () => void;
  onCancelClearChat: () => void;
  onConfirmClearChat: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const quickPrompts = [
    {
      label: "Save company",
      value:
        "Save my company profile: we are building [describe product, customer, category, geography, differentiator]."
    },
    {
      label: "Find competitors",
      value: productProfile?.description
        ? `Using my saved company profile for ${productProfile.name}, discover likely competitors with Crustdata and save them to the pending suggestions queue.`
        : "After I describe my company, save that context and discover likely competitors with Crustdata."
    }
  ];
  const lastAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, status]);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Agent chat">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-0 shadow-sm">
        <CardHeader className="shrink-0 border-b bg-card/95 px-5 py-3">
          <div className="flex items-center justify-between gap-4 max-[720px]:grid">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
                  <Bot className="size-4" aria-hidden="true" />
                </span>
                <span className="truncate">Workspace operator</span>
              </CardTitle>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 max-[720px]:justify-start">
              <StatusBadge tone={isBusy ? "info" : "success"} label={isBusy ? "Streaming" : "Ready"} />
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </Badge>
              <Button
                className="h-8 rounded-full text-muted-foreground hover:text-destructive"
                size="sm"
                variant="outline"
                type="button"
                disabled={isBusy || isClearingChat || messages.length === 0}
                onClick={onRequestClearChat}
                aria-label="Clear chat"
                title="Clear chat"
              >
                {isClearingChat ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {isClearingChat ? "Clearing" : "Clear"}
              </Button>
            </div>
          </div>
          {isConfirmingClearChat && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
                  <p className="m-0 text-sm leading-6">
                    <span className="font-semibold">Clear chat history?</span>{" "}
                    <span className="text-red-800">
                      This removes saved messages for this workspace.
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    className="border-red-200 bg-white/80 hover:bg-white"
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={isClearingChat}
                    onClick={onCancelClearChat}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    type="button"
                    disabled={isBusy || isClearingChat}
                    onClick={onConfirmClearChat}
                  >
                    {isClearingChat ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    {isClearingChat ? "Clearing..." : "Clear chat"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            ref={scrollRef}
            className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain bg-muted/25 p-5 max-[720px]:p-3"
          >
            {messages.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title="No chat history"
                detail="Describe your company, ask the agent to find competitors, explain signals, or draft artifacts."
              />
            )}
            {messages.map((message, index) => (
              <AgentChatMessage
                key={`${message.role}-${index}`}
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
          <form className="shrink-0 border-t bg-card p-4 max-[720px]:p-3" onSubmit={sendMessage}>
            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt.label}
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={isBusy}
                  onClick={() => setChatInput(prompt.value)}
                >
                  {prompt.label === "Save company" ? <Command /> : <Search />}
                  {prompt.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border bg-background p-2 shadow-inner shadow-black/5 max-[720px]:grid-cols-1">
              <label className="sr-only" htmlFor="chat-input">
                Message CounterOS
              </label>
              <Input
                id="chat-input"
                className="h-12 border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Describe your company, discover competitors, or explain a signal"
              />
              <Button className="h-12 rounded-xl px-5" type="submit" disabled={isBusy}>
                {isBusy ? <Loader2 className="animate-spin" /> : <Send />}
                {isBusy ? "Running" : "Send"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
  const lastStepStartIndex = message.parts.findLastIndex((part) => part.type === "step-start");
  const hasRenderedParts =
    message.parts.some(isRenderableMessagePart) || (isActive && lastStepStartIndex >= 0);

  if (!hasRenderedParts && !isActive) {
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
        {message.parts.map((part, index) => {
          const showStepStart =
            isActive &&
            index === lastStepStartIndex &&
            !hasRenderablePartsAfter(message.parts, index);

          return (
            <AgentMessagePart
              key={index}
              part={part}
              isUser={isUser}
              showStepStart={showStepStart}
            />
          );
        })}
        {!hasRenderedParts && isActive && <AgentInlinePending />}
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

function AgentInlinePending() {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg border bg-background/80 px-3 py-2">
      <div className="grid size-7 place-items-center rounded-full border bg-card">
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <strong className="text-sm font-semibold">Preparing response</strong>
          <StatusBadge tone="info" label="Running" />
        </div>
        <p className="m-0 mt-1 text-sm leading-6 text-muted-foreground">
          Keeping the response open while the next streamed part arrives.
        </p>
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
  isBusy,
  isEnriching,
  isRemoving,
  isConfirmingRemove,
  onEnrich,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove
}: {
  competitor: CompetitorProfile;
  isBusy: boolean;
  isEnriching: boolean;
  isRemoving: boolean;
  isConfirmingRemove: boolean;
  onEnrich: () => void;
  onRequestRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
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

      <div className="flex flex-wrap justify-end gap-2 max-[980px]:justify-start">
        <Button
          variant="outline"
          type="button"
          disabled={isBusy || isEnriching || isRemoving}
          onClick={onEnrich}
        >
          {isEnriching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {isEnriching ? "Enriching..." : "Enrich"}
        </Button>
        <Button
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          variant="ghost"
          type="button"
          disabled={isBusy || isEnriching || isRemoving}
          onClick={onRequestRemove}
        >
          <Trash2 />
          Remove
        </Button>
      </div>

      {competitor.enrichmentError && (
        <p className="col-span-full m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {competitor.enrichmentError}
        </p>
      )}

      {isConfirmingRemove && (
        <div className="col-span-full rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
            <div className="grid size-10 place-items-center rounded-lg border border-red-200 bg-white/70 text-red-600">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h4 className="m-0 text-sm font-semibold">
                Remove {competitor.name} from tracking?
              </h4>
              <p className="m-0 mt-1 text-sm leading-6 text-red-800">
                The company leaves the approved list and linked tracked pages are paused.
                Historical signals stay available for reference.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              className="border-red-200 bg-white/80 hover:bg-white"
              variant="outline"
              type="button"
              disabled={isRemoving}
              onClick={onCancelRemove}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={isBusy || isRemoving}
              onClick={onConfirmRemove}
            >
              {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {isRemoving ? "Removing..." : "Remove tracking"}
            </Button>
          </div>
        </div>
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

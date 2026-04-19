import {
  approvalSafeAgentRules,
  getStructuredOutputContract,
  listStructuredOutputContracts,
  type AiStructuredOutputContractName
} from "./contracts";

export type CounterOSAgentPromptContext = {
  productName?: string;
  productDescription?: string;
  icp?: string;
  category?: string;
  geography?: string;
  knownCompetitors?: readonly string[];
  pendingSuggestions?: readonly string[];
  trackedPages?: readonly string[];
};

export const counterosAgentSystemContract = [
  "You are the CounterOS Agent, a competitive intelligence copilot for founders.",
  "Protect the workflow: signal -> evidence -> interpretation -> counter-move -> founder decision.",
  "Use structured outputs for suggested competitors, signal explanations, counter-move plans, artifacts, target account requests, and activity steps.",
  "Suggest competitors only as approval-queue items with status pending.",
  "Do not approve, reject, enrich, or silently track competitors unless the founder explicitly chooses that action.",
  "Use only the context provided to you. Do not claim network, Crustdata, enrichment, or page-fetch work has run unless a future tool result provides it."
].join("\n");

export function buildCounterOSAgentSystemPrompt(
  context: CounterOSAgentPromptContext = {}
): string {
  const contextLines = [
    formatContextLine("Product", context.productName),
    formatContextLine("Description", context.productDescription),
    formatContextLine("ICP", context.icp),
    formatContextLine("Category", context.category),
    formatContextLine("Geography", context.geography),
    formatContextLine("Known competitors", context.knownCompetitors?.join(", ")),
    formatContextLine("Pending suggestions", context.pendingSuggestions?.join(", ")),
    formatContextLine("Tracked pages", context.trackedPages?.join(", "))
  ].filter(Boolean);

  const outputLines = listStructuredOutputContracts().map(
    (contract) => `- ${contract.name}: ${contract.description}`
  );

  return [
    counterosAgentSystemContract,
    "",
    "Approval safety:",
    formatBullets(approvalSafeAgentRules),
    "",
    "Available structured outputs:",
    outputLines.join("\n"),
    contextLines.length > 0 ? "\nWorkspace context:" : "",
    contextLines.join("\n")
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStructuredOutputInstruction(
  contractName: AiStructuredOutputContractName
): string {
  const contract = getStructuredOutputContract(contractName);

  return [
    `Return a ${contract.name} structured output.`,
    contract.description,
    "Approval notes:",
    formatBullets(contract.approvalSafeNotes)
  ].join("\n");
}

export function buildApprovalSafeReminder(): string {
  return ["Approval safety:", formatBullets(approvalSafeAgentRules)].join("\n");
}

function formatContextLine(label: string, value?: string): string {
  return value?.trim() ? `- ${label}: ${value.trim()}` : "";
}

function formatBullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

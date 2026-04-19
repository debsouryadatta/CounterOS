import { randomUUID } from "crypto";
import { createAgentUIStreamResponse, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCounterOSAgent,
  extractTextFromUIMessage,
  type CounterOSAgentUIMessage
} from "@/lib/ai/agent";
import { requireWorkspace } from "@/lib/auth/workspace";
import { appendChatTurn, recordAgentActivity } from "@/lib/db/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

const uiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(z.unknown())
});

const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1)
});

const legacyMessageSchema = z.object({
  text: z.string().trim().min(1).max(2000)
});

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  const legacyParsed = legacyMessageSchema.safeParse(body);
  const uiMessages = parsed.success
    ? (parsed.data.messages as UIMessage[])
    : legacyParsed.success
      ? toLegacyUIMessage(legacyParsed.data.text)
      : null;

  if (!uiMessages) {
    return NextResponse.json({ error: "Enter a message first." }, { status: 400 });
  }

  const latestUserText = getLatestUserText(uiMessages);

  if (!latestUserText) {
    return NextResponse.json({ error: "Enter a message first." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    const agentText =
      "OPENAI_API_KEY is not configured, so I saved your message but could not run the AI agent.";

    recordAgentActivity({
      workspaceId: auth.workspace.id,
      label: "Check OpenAI configuration",
      source: "OpenAI",
      status: "Needs approval",
      evidence: "OPENAI_API_KEY is missing, so the AI SDK agent could not run."
    });
    appendChatTurn({
      workspaceId: auth.workspace.id,
      userText: latestUserText,
      agentText
    });

    return createFallbackUIStreamResponse(uiMessages, agentText);
  }

  const agent = createCounterOSAgent(auth.workspace.id);
  const agentMessages = uiMessages as CounterOSAgentUIMessage[];

  return createAgentUIStreamResponse({
    agent,
    uiMessages: agentMessages,
    originalMessages: agentMessages,
    abortSignal: request.signal,
    onFinish: ({ responseMessage, isAborted }) => {
      if (isAborted) {
        return;
      }

      appendChatTurn({
        workspaceId: auth.workspace.id,
        userText: latestUserText,
        agentText:
          extractTextFromUIMessage(responseMessage) ||
          "I completed the requested tool run. Review the streamed tool results above."
      });
    },
    onError: (error) =>
      error instanceof Error ? error.message : "The agent stream failed unexpectedly."
  });
}

function toLegacyUIMessage(text: string): UIMessage[] {
  return [
    {
      id: randomUUID(),
      role: "user",
      parts: [{ type: "text", text }]
    }
  ];
}

function getLatestUserText(messages: UIMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role === "user") {
      const text = extractTextFromUIMessage(message);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function createFallbackUIStreamResponse(originalMessages: UIMessage[], text: string) {
  const stream = createUIMessageStream<UIMessage>({
    originalMessages,
    execute: ({ writer }) => {
      const textId = randomUUID();

      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", finishReason: "stop" });
    }
  });

  return createUIMessageStreamResponse({ stream });
}

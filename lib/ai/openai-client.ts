import "server-only";

export type OpenAIResponseInputMessage = {
  role: "system" | "user" | "assistant";
  content: Array<{
    type: "input_text";
    text: string;
  }>;
};

export type CreateOpenAIResponseInput = {
  input: OpenAIResponseInputMessage[];
  model?: string;
  maxOutputTokens?: number;
};

export class OpenAIClientError extends Error {
  status: number | undefined;
  responseBody: string | undefined;

  constructor(message: string, input: { status?: number; responseBody?: string } = {}) {
    super(message);
    this.name = "OpenAIClientError";
    this.status = input.status;
    this.responseBody = input.responseBody;
  }
}

export async function createOpenAITextResponse(input: CreateOpenAIResponseInput) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new OpenAIClientError("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: input.model ?? process.env.COUNTERLESS_OPENAI_MODEL ?? "gpt-5.4-mini",
      input: input.input,
      max_output_tokens: input.maxOutputTokens ?? 1400
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new OpenAIClientError(`OpenAI request failed with status ${response.status}.`, {
      status: response.status,
      responseBody: await response.text().catch(() => "")
    });
  }

  return extractOutputText((await response.json()) as OpenAIResponse);
}

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractOutputText(response: OpenAIResponse) {
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text)
      .join("\n")
      .trim() ?? ""
  );
}

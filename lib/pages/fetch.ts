export type PageFetchResult = {
  url: string;
  title: string | null;
  extractedText: string;
};

export async function fetchPageText(url: string): Promise<PageFetchResult> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html, text/plain;q=0.9, */*;q=0.5",
      "user-agent": "CounterOSBot/0.1 (+https://counteros.local)"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error(`Page fetch failed with status ${response.status}.`);
  }

  const html = await response.text();

  return {
    url: response.url || url,
    title: extractTitle(html),
    extractedText: extractReadableText(html)
  };
}

export function summarizeTextDiff(previousText: string | null, nextText: string) {
  if (!previousText) {
    return "Initial snapshot captured.";
  }

  const previousWords = new Set(tokenize(previousText));
  const nextWords = new Set(tokenize(nextText));
  const added = [...nextWords].filter((word) => !previousWords.has(word)).slice(0, 18);
  const removed = [...previousWords].filter((word) => !nextWords.has(word)).slice(0, 18);

  if (added.length === 0 && removed.length === 0) {
    return "No meaningful text changes detected.";
  }

  return [
    added.length > 0 ? `Added terms: ${added.join(", ")}.` : "",
    removed.length > 0 ? `Removed terms: ${removed.join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
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

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length >= 4 && word.length <= 28);
}

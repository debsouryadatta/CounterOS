import {
  normalizeObservabilityEvent,
  type NormalizedObservabilityEvent,
  type ObservabilityEvent,
  type ObservabilityEventLevel,
  type ObservabilityEventName
} from "./events";

export type ObservabilitySink = (
  event: NormalizedObservabilityEvent
) => void | Promise<void>;

export type ObservabilityLogger = {
  emit: (event: ObservabilityEvent) => void;
  debug: (name: ObservabilityEventName, metadata?: Record<string, unknown>) => void;
  info: (name: ObservabilityEventName, metadata?: Record<string, unknown>) => void;
  warn: (name: ObservabilityEventName, metadata?: Record<string, unknown>) => void;
  error: (name: ObservabilityEventName, metadata?: Record<string, unknown>) => void;
};

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|token|api[_-]?key|session)/i;

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[max-depth]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeForLog(nestedValue, depth + 1)
      ])
    );
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

function consoleMethodForLevel(level: ObservabilityEventLevel): "debug" | "info" | "warn" | "error" {
  if (level === "debug") return "debug";
  if (level === "warn") return "warn";
  if (level === "error") return "error";
  return "info";
}

export function createObservabilityLogger(options?: {
  sink?: ObservabilitySink;
  enabled?: boolean;
}): ObservabilityLogger {
  const enabled = options?.enabled ?? true;
  const sink = options?.sink;

  function emit(event: ObservabilityEvent): void {
    if (!enabled || typeof window !== "undefined") {
      return;
    }

    const normalized = sanitizeForLog(
      normalizeObservabilityEvent(event)
    ) as NormalizedObservabilityEvent;
    const method = consoleMethodForLevel(normalized.level);

    try {
      console[method]("[observability]", normalized);
      void sink?.(normalized);
    } catch {
      // Logging must never break request handling or background jobs.
    }
  }

  function emitLevel(
    level: ObservabilityEventLevel,
    name: ObservabilityEventName,
    metadata?: Record<string, unknown>
  ): void {
    emit({
      name,
      level,
      metadata
    } as ObservabilityEvent);
  }

  return {
    emit,
    debug: (name, metadata) => emitLevel("debug", name, metadata),
    info: (name, metadata) => emitLevel("info", name, metadata),
    warn: (name, metadata) => emitLevel("warn", name, metadata),
    error: (name, metadata) => emitLevel("error", name, metadata)
  };
}

export const observabilityLogger = createObservabilityLogger();

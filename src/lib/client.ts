/**
 * Thin HTTP client for the MotionBoards REST API.
 *
 * Auth: every request sends `Authorization: Bearer <MOTIONBOARDS_API_KEY>`.
 * The user creates this key in motionboards.vercel.app → Settings → API Keys
 * and exposes it to the MCP via the MOTIONBOARDS_API_KEY env var.
 */

const DEFAULT_BASE_URL = "https://motionboards.vercel.app";

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadClientConfig(): ClientConfig {
  const apiKey = process.env.MOTIONBOARDS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "MOTIONBOARDS_API_KEY is not set. Generate one at motionboards.vercel.app → Settings → API Keys, then export MOTIONBOARDS_API_KEY=mb_… in your shell or MCP server config.",
    );
  }
  if (!apiKey.startsWith("mb_")) {
    throw new Error(
      "MOTIONBOARDS_API_KEY does not look like a MotionBoards key (expected to start with 'mb_').",
    );
  }
  const baseUrl = (process.env.MOTIONBOARDS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

export interface ApiCallOptions {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  /** Don't throw on non-2xx; return the response text in `text` and status. */
  allowNon2xx?: boolean;
  /** Hard timeout in ms (default 60_000). */
  timeoutMs?: number;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  text?: string;
  error?: string;
}

export async function apiCall<T = unknown>(
  config: ClientConfig,
  path: string,
  options: ApiCallOptions = {},
): Promise<ApiResponse<T>> {
  const url = new URL(path, config.baseUrl + "/");
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  let body: BodyInit | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const parsed = (await res.json()) as T & { error?: string };
      if (!res.ok && !options.allowNon2xx) {
        return {
          ok: false,
          status: res.status,
          data: parsed,
          error: parsed?.error || `HTTP ${res.status}`,
        };
      }
      return { ok: res.ok, status: res.status, data: parsed };
    }

    const text = await res.text();
    if (!res.ok && !options.allowNon2xx) {
      return {
        ok: false,
        status: res.status,
        text,
        error: text || `HTTP ${res.status}`,
      };
    }
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      return { ok: false, status: 0, error: `Request timed out after ${options.timeoutMs ?? 60_000}ms` };
    }
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

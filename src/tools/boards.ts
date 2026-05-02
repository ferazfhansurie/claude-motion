import { apiCall, type ClientConfig } from "../lib/client.js";

export const boardsSchema = {} as const;

/**
 * The /api/boards response is a single JSON blob containing the user's full
 * canvas state. Shape varies as the MotionBoards UI evolves, but typically:
 *   { boards: [{ id, name, items: [...] }, ...], activeBoardId, selectedModelId }
 *
 * For an MCP, we return a summarised view (board names + item counts) so the
 * model doesn't drown in the full canvas data on every call.
 */
export async function boardsTool(config: ClientConfig) {
  const res = await apiCall<unknown>(config, "/api/boards");
  if (!res.ok) {
    return errorResult(res.error || "Could not fetch boards.");
  }

  const data = res.data as Record<string, unknown> | undefined;
  if (!data || Object.keys(data).length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No boards yet. Open motionboards.vercel.app to create one — your first generation will populate it automatically.",
        },
      ],
    };
  }

  const boards = Array.isArray((data as { boards?: unknown[] }).boards)
    ? ((data as { boards: unknown[] }).boards as Record<string, unknown>[])
    : [];

  if (boards.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Boards data exists but no individual boards found. Open motionboards.vercel.app and create a canvas.",
        },
      ],
    };
  }

  const activeBoardId = (data as { activeBoardId?: string }).activeBoardId;
  const selectedModelId = (data as { selectedModelId?: string }).selectedModelId;

  const lines = [`${boards.length} board${boards.length === 1 ? "" : "s"}:`, ""];
  for (const b of boards) {
    const id = String(b.id ?? "?");
    const name = String(b.name ?? "Untitled");
    const items = Array.isArray(b.items) ? (b.items as unknown[]).length : 0;
    const activeMark = id === activeBoardId ? " (active)" : "";
    lines.push(`  ● ${name}${activeMark}`);
    lines.push(`     id:    ${id}`);
    lines.push(`     items: ${items}`);
  }

  if (selectedModelId) {
    lines.push("");
    lines.push(`currently selected model: ${selectedModelId}`);
  }

  lines.push("");
  lines.push("Generated assets land in your canvas — open motionboards.vercel.app to view them.");

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

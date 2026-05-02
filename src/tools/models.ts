import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";

export const modelsSchema = {
  filter: z
    .string()
    .optional()
    .describe(
      "Substring filter applied to id, name, type, and provider. Useful to narrow large catalogs (e.g. 'veo', 'i2v', 'lipsync', 'nano-banana').",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .default(50)
    .describe("Max models to return. Default 50."),
};

interface ModelEntry {
  id: string;
  name: string;
  type: string;
  provider: string;
  creditCost: number;
  inputs: { name: string; type: string; required: boolean; description: string }[];
}

interface ModelsResponse {
  models: ModelEntry[];
}

export async function modelsTool(
  config: ClientConfig,
  args: { filter?: string; limit?: number },
) {
  const res = await apiCall<ModelsResponse>(config, "/api/models");
  if (!res.ok || !res.data) {
    return errorResult(res.error || "Could not fetch models.");
  }

  const filter = args.filter?.trim().toLowerCase();
  let entries = res.data.models;
  if (filter) {
    entries = entries.filter((m) =>
      [m.id, m.name, m.type, m.provider].some((s) => s.toLowerCase().includes(filter)),
    );
  }
  const limited = entries.slice(0, args.limit ?? 50);

  if (limited.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: filter
            ? `No models matched '${filter}'.`
            : "No models available — check API key permissions.",
        },
      ],
    };
  }

  const lines = [
    `${limited.length} model${limited.length === 1 ? "" : "s"}${entries.length > limited.length ? ` (of ${entries.length} total)` : ""}:`,
    "",
  ];
  for (const m of limited) {
    const cost = m.creditCost ? `RM${(m.creditCost / 100).toFixed(2)}` : "free";
    const required = m.inputs.filter((i) => i.required).map((i) => i.name).join(", ") || "—";
    lines.push(`  [${m.type}] ${m.id}`);
    lines.push(`     ${m.name} · ${m.provider} · ${cost}`);
    lines.push(`     required inputs: ${required}`);
  }

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

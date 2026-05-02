import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";

export const statusSchema = {
  requestId: z.string().min(1).describe("requestId returned by `generate` for async models."),
  modelId: z.string().min(1).describe("modelId returned by `generate`. Same shape as the model id."),
  generationId: z
    .string()
    .min(1)
    .describe("generationId returned by `generate` — the MotionBoards-side record."),
};

interface StatusResponse {
  status?: "processing" | "completed" | "failed" | string;
  log?: string;
  outputUrl?: string;
  error?: string;
  /** Voice-clone-style 2-step jobs surface a chained job here. */
  nextRequestId?: string;
  nextModelId?: string;
  cost?: string;
}

export async function statusTool(
  config: ClientConfig,
  args: { requestId: string; modelId: string; generationId: string },
) {
  const res = await apiCall<StatusResponse>(config, "/api/generate/status", {
    query: {
      requestId: args.requestId,
      modelId: args.modelId,
      generationId: args.generationId,
    },
    timeoutMs: 60_000,
  });

  if (!res.ok || !res.data) {
    return errorResult(res.error || "Status check failed.");
  }

  const data = res.data;

  if (data.status === "completed" && data.outputUrl) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `✓ generation complete`,
            `output: ${data.outputUrl}`,
            data.cost ? `cost:   ${data.cost}` : null,
            "",
            "The asset is now in your generations history. Open MotionBoards to drag it onto your canvas.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }

  if (data.status === "failed") {
    return errorResult(data.error || "Generation failed without a message.");
  }

  // Voice-clone chain — second job submitted, return its identifiers
  if (data.nextRequestId && data.nextModelId) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `⏳ ${data.log || "step 1 done — running step 2"}`,
            `nextRequestId: ${data.nextRequestId}`,
            `nextModelId:   ${data.nextModelId}`,
            "",
            "Continue polling with the new requestId/modelId.",
          ].join("\n"),
        },
      ],
    };
  }

  // Still processing
  return {
    content: [
      {
        type: "text" as const,
        text: [
          `⏳ status: ${data.status ?? "processing"}`,
          data.log ? `log:    ${data.log}` : null,
          "",
          "Call `status` again in 5–10s to keep polling.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

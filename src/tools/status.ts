import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";
import { placeAssetOnBoard } from "../lib/place-on-board.js";

export const statusSchema = {
  requestId: z.string().min(1).describe("requestId returned by `generate` for async models."),
  modelId: z.string().min(1).describe("modelId returned by `generate`. Same shape as the model id."),
  generationId: z
    .string()
    .min(1)
    .describe("generationId returned by `generate` — the MotionBoards-side record."),
  add_to_board: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "If true (default), the completed asset is auto-placed on the active MotionBoards canvas when the job completes.",
    ),
  board_id: z
    .string()
    .optional()
    .describe("Override the target board for auto-placement. Defaults to the active board."),
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
  args: {
    requestId: string;
    modelId: string;
    generationId: string;
    add_to_board?: boolean;
    board_id?: string;
  },
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
    const lines: (string | null)[] = [
      `✓ generation complete`,
      `output: ${data.outputUrl}`,
      data.cost ? `cost:   ${data.cost}` : null,
    ];

    if (args.add_to_board ?? true) {
      const outputType = inferOutputType(args.modelId, data.outputUrl);
      const placed = await placeAssetOnBoard(config, {
        outputUrl: data.outputUrl,
        outputType,
        modelId: args.modelId,
        cost: data.cost,
        targetBoardId: args.board_id,
      });
      if (placed.ok) {
        lines.push("");
        lines.push(`✓ placed on board ${placed.boardName ?? placed.boardId}`);
        lines.push("Open motionboards.vercel.app to see it on your canvas.");
      } else {
        lines.push("");
        lines.push(`⚠ asset ready but could not auto-place on board: ${placed.reason}`);
        lines.push("It's still in your generations history.");
      }
    } else {
      lines.push("");
      lines.push("Asset is in your generations history. Open MotionBoards to drag it onto a canvas.");
    }

    return {
      content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
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

function inferOutputType(modelId: string, url: string): "image" | "video" | "audio" {
  const m = modelId.toLowerCase();
  if (/(veo|seedance|t2v|i2v|s2e|video|lipsync|wan-)/.test(m)) return "video";
  if (/(audio|tts|music|sfx|voice|demucs|mmaudio|ace-step|stable-audio)/.test(m)) return "audio";
  if (/(banana|flux|gpt-image|t2i|i2i|image)/.test(m)) return "image";
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";
  return "image";
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

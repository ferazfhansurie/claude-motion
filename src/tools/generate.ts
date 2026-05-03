import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";
import { placeAssetOnBoard } from "../lib/place-on-board.js";

export const generateSchema = {
  model: z
    .string()
    .min(1)
    .describe(
      "The model id (e.g. 'gemini-3.1-flash-image-preview', 'veo-3.1-fast-generate-preview/i2v'). Use the `models` tool to discover the catalog.",
    ),
  prompt: z
    .string()
    .optional()
    .describe(
      "Text prompt. Required for text-to-image / text-to-video models. Optional or ignored for some image-to-image / lipsync models.",
    ),
  inputImage: z
    .string()
    .optional()
    .describe("Single-image input URL. Use the `upload` tool to publish a local file first."),
  inputImages: z
    .array(z.string())
    .optional()
    .describe("Multi-image input URLs (e.g. for face swap, multi-ref edits)."),
  startFrame: z
    .string()
    .optional()
    .describe("Start-frame URL for start-and-end (s2e) models like Veo 3.1 first-last-frame-to-video."),
  endFrame: z
    .string()
    .optional()
    .describe("End-frame URL for start-and-end (s2e) models."),
  inputAudio: z
    .string()
    .optional()
    .describe("Audio URL for lipsync / voice-clone models."),
  generationOptions: z
    .record(z.unknown())
    .optional()
    .describe(
      "Free-form model-specific options (aspect_ratio, duration, resolution, generate_audio, etc.). Forwarded as-is.",
    ),
  add_to_board: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "If true (default), the completed asset is auto-placed on the active MotionBoards canvas so it shows up in the UI without a manual drag. Only applies to sync generations — async (Veo) jobs are placed by the `status` tool when they complete.",
    ),
  board_id: z
    .string()
    .optional()
    .describe(
      "Override the target board for auto-placement. If omitted, uses the active board (selected in the web UI).",
    ),
};

interface GenerateResponse {
  generationId?: string;
  requestId?: string;
  modelId?: string;
  status?: string;
  outputUrl?: string;
  cost?: string;
  result?: unknown;
  error?: string;
}

export async function generateTool(
  config: ClientConfig,
  args: {
    model: string;
    prompt?: string;
    inputImage?: string;
    inputImages?: string[];
    startFrame?: string;
    endFrame?: string;
    inputAudio?: string;
    generationOptions?: Record<string, unknown>;
    add_to_board?: boolean;
    board_id?: string;
  },
) {
  const body = {
    model: args.model,
    prompt: args.prompt,
    inputImage: args.inputImage,
    inputImages: args.inputImages,
    startFrame: args.startFrame,
    endFrame: args.endFrame,
    inputAudio: args.inputAudio,
    generationOptions: args.generationOptions,
  };

  const res = await apiCall<GenerateResponse>(config, "/api/generate", {
    method: "POST",
    body,
    timeoutMs: 5 * 60_000, // sync models can take a few minutes
  });

  if (!res.ok || !res.data) {
    return errorResult(res.error || "Generation failed.");
  }

  const data = res.data;

  // Sync result — output ready immediately
  if (data.outputUrl) {
    const lines: (string | null)[] = [
      `✓ generation complete (sync)`,
      `model:    ${args.model}`,
      data.generationId ? `id:       ${data.generationId}` : null,
      `output:   ${data.outputUrl}`,
    ];

    // Auto-place on board (default true)
    if (args.add_to_board ?? true) {
      const outputType = inferOutputType(args.model, data.outputUrl);
      const placed = await placeAssetOnBoard(config, {
        outputUrl: data.outputUrl,
        outputType,
        modelId: args.model,
        prompt: args.prompt,
        cost: data.cost,
        targetBoardId: args.board_id,
      });

      if (placed.ok) {
        lines.push(``);
        lines.push(`✓ placed on board ${placed.boardName ?? placed.boardId}`);
        lines.push(`Open motionboards.vercel.app to see it on your canvas.`);
      } else {
        lines.push(``);
        lines.push(
          `⚠ asset generated but could not auto-place on board: ${placed.reason}`,
        );
        lines.push(
          `It's still in your generations history — open MotionBoards to drag it onto a canvas.`,
        );
      }
    } else {
      lines.push(``);
      lines.push(
        `Asset is in your generations history. Open MotionBoards to drag it onto a canvas.`,
      );
    }

    return {
      content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
    };
  }

  // Async — return polling info
  if (data.requestId && data.modelId) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `⏳ generation submitted (async — Veo / long-running)`,
            `model:        ${args.model}`,
            `requestId:    ${data.requestId}`,
            `modelId:      ${data.modelId}`,
            data.generationId ? `generationId: ${data.generationId}` : null,
            "",
            "Poll with the `status` tool, passing requestId, modelId, and generationId. Typically ready in 30–120s for video.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }

  // Fallback
  return {
    content: [
      {
        type: "text" as const,
        text: `Generation accepted but no recognizable output payload:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

function inferOutputType(modelId: string, url: string): "image" | "video" | "audio" {
  const m = modelId.toLowerCase();
  if (/(veo|seedance|t2v|i2v|s2e|video|lipsync|wan-)/.test(m)) return "video";
  if (/(audio|tts|music|sfx|voice|demucs|mmaudio|ace-step|stable-audio)/.test(m)) return "audio";
  if (/(banana|flux|gpt-image|t2i|i2i|image)/.test(m)) return "image";
  // Fallback by extension
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";
  return "image";
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

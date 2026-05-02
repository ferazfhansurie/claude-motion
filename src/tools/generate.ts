import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";

export const generateSchema = {
  model: z
    .string()
    .min(1)
    .describe(
      "The model id (e.g. 'fal-ai/nano-banana-2', 'fal-ai/veo3.1/fast/image-to-video'). Use the `models` tool to discover the catalog.",
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
};

interface GenerateResponse {
  generationId?: string;
  requestId?: string;
  modelId?: string;
  status?: string;
  outputUrl?: string;
  /** Some sync models return data immediately. */
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
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `✓ generation complete (sync)`,
            `model:    ${args.model}`,
            data.generationId ? `id:       ${data.generationId}` : null,
            `output:   ${data.outputUrl}`,
            "",
            "The asset is now in your generations history. Open MotionBoards to drag it onto your canvas.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
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

  // Fallback — return whatever the API gave us
  return {
    content: [
      {
        type: "text" as const,
        text: `Generation accepted but no recognizable output payload:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

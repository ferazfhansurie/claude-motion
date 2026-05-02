#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadClientConfig } from "./lib/client.js";
import { creditsSchema, creditsTool } from "./tools/credits.js";
import { modelsSchema, modelsTool } from "./tools/models.js";
import { uploadSchema, uploadTool } from "./tools/upload.js";
import { generateSchema, generateTool } from "./tools/generate.js";
import { statusSchema, statusTool } from "./tools/status.js";
import { boardsSchema, boardsTool } from "./tools/boards.js";

const VERSION = "1.0.0";

async function main(): Promise<void> {
  const config = loadClientConfig();

  const server = new McpServer({
    name: "motionboards-mcp",
    version: VERSION,
  });

  server.registerTool(
    "credits",
    {
      title: "Check credit balance",
      description:
        "Show the MotionBoards account balance and subscription status for the configured API key. Every generation deducts from this balance.",
      inputSchema: creditsSchema,
    },
    async () => creditsTool(config),
  );

  server.registerTool(
    "models",
    {
      title: "List available models",
      description:
        "Discover the MotionBoards generation catalog (Veo, Nano Banana, Seedance, OmniHuman, Sync Lipsync, etc.) along with each model's id, type, provider, credit cost, and required inputs. Use the filter argument to narrow down (e.g. 'i2v', 'lipsync', 'nano-banana').",
      inputSchema: modelsSchema,
    },
    async (args) => modelsTool(config, args),
  );

  server.registerTool(
    "upload",
    {
      title: "Upload an asset",
      description:
        "Publish a local file or remote URL to MotionBoards Blob storage. Returns a public URL you can pass as inputImage / inputAudio / startFrame / endFrame to `generate`. Supports images, video, audio, PSD.",
      inputSchema: uploadSchema,
    },
    async (args) => uploadTool(config, args),
  );

  server.registerTool(
    "generate",
    {
      title: "Generate an image or video",
      description:
        "Submit a generation job to MotionBoards. Pass the model id (use `models` to discover), a prompt and/or input asset URLs (use `upload` to publish files first). Sync models return the output URL immediately. Async models (Veo) return polling identifiers — pass them to the `status` tool.",
      inputSchema: generateSchema,
    },
    async (args) => generateTool(config, args),
  );

  server.registerTool(
    "status",
    {
      title: "Poll an async generation",
      description:
        "Poll the status of an async generation (Veo and other long-running jobs). Returns the output URL when complete, an error if failed, or a 'processing' marker to keep polling. Pass the requestId, modelId, and generationId returned by `generate`.",
      inputSchema: statusSchema,
    },
    async (args) => statusTool(config, args),
  );

  server.registerTool(
    "boards",
    {
      title: "List your boards",
      description:
        "List the canvases on your MotionBoards account (name, item count, active board). Generated assets land on these canvases — open motionboards.vercel.app to view, refine, or rearrange.",
      inputSchema: boardsSchema,
    },
    async () => boardsTool(config),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

main().catch((err) => {
  console.error("[motionboards-mcp] fatal:", err);
  process.exit(1);
});

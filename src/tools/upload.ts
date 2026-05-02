import { z } from "zod";
import { apiCall, type ClientConfig } from "../lib/client.js";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export const uploadSchema = {
  source: z
    .string()
    .min(1)
    .describe(
      "Source of the asset. Either an absolute local file path (e.g. /Users/me/img.png) or a remote URL (https://…). The file is uploaded to MotionBoards Blob and a public URL is returned.",
    ),
  filename: z
    .string()
    .optional()
    .describe(
      "Optional filename override. Defaults to the source's basename for files, or 'remote.bin' for URLs.",
    ),
};

export async function uploadTool(config: ClientConfig, args: { source: string; filename?: string }) {
  let bytes: Uint8Array;
  let inferredName: string;
  let contentType = "application/octet-stream";

  if (/^https?:\/\//i.test(args.source)) {
    // Remote URL — fetch, then re-upload to MotionBoards
    try {
      const remote = await fetch(args.source);
      if (!remote.ok) {
        return errorResult(`Failed to fetch remote source: HTTP ${remote.status}`);
      }
      bytes = new Uint8Array(await remote.arrayBuffer());
      inferredName = basename(new URL(args.source).pathname) || "remote.bin";
      contentType = remote.headers.get("content-type") || guessContentType(inferredName);
    } catch (err) {
      return errorResult(
        `Could not fetch remote source: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    // Local file path
    try {
      bytes = await readFile(args.source);
      inferredName = basename(args.source);
      contentType = guessContentType(inferredName);
    } catch (err) {
      return errorResult(
        `Could not read local file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const filename = args.filename || inferredName;

  const res = await apiCall<{ url: string }>(config, "/api/upload", {
    method: "POST",
    // Cast: Node 22's Uint8Array is widened to allow SharedArrayBuffer-backed
    // instances, but Blob's BlobPart only accepts ArrayBuffer-backed views.
    // readFile / arrayBuffer always return ArrayBuffer-backed bytes at runtime.
    rawBody: new Blob([bytes as BlobPart], { type: contentType }),
    headers: {
      "Content-Type": contentType,
      "x-filename": filename,
    },
    timeoutMs: 5 * 60_000, // 5 min for big uploads
  });

  if (!res.ok || !res.data?.url) {
    return errorResult(res.error || "Upload failed.");
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `✓ Uploaded ${filename} (${bytes.byteLength.toLocaleString()} bytes, ${contentType})\nurl: ${res.data.url}\n\nUse this URL as input to the \`generate\` tool (e.g. inputImage, inputAudio).`,
      },
    ],
  };
}

function guessContentType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    psd: "image/vnd.adobe.photoshop",
  };
  return map[ext] ?? "application/octet-stream";
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

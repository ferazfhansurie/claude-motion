# motionboards-mcp

> MotionBoards inside Claude Code. Generate AI images and videos with 30+ models — Veo, Sora, Nano Banana, Kling, Seedance, Sync Lipsync — and the result lands on your MotionBoards canvas.

[![npm](https://img.shields.io/npm/v/motionboards-mcp.svg)](https://www.npmjs.com/package/motionboards-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

You're in your terminal. You ask Claude for a 5-second clip from a still image. Claude calls `generate`, MotionBoards runs Veo 3.1, your generation lands on your canvas. You open the canvas to refine, edit, sequence — every model in MotionBoards' catalog is available without leaving Claude Code.

Six tools. Bring-your-own MotionBoards subscription. Nothing else to set up.

---

## What you can do

- "make a 5s i2v from this image" — `upload` → `generate` (Veo / Seedance / Kling I2V) → drag from canvas
- "lipsync this photo to this audio" — `upload` ×2 → `generate` (Sync Lipsync / OmniHuman) → canvas
- "edit this image with nano banana — add a neon background" — `upload` → `generate` (Nano Banana Edit) → canvas
- "fill in motion between these two frames" — `upload` ×2 → `generate` (Veo 3.1 first-last-frame) → canvas
- "what's my credit balance" — `credits`
- "what models are available for image-to-video" — `models filter:i2v`

---

## Install

```bash
npm install -g motionboards-mcp
```

Or run with `npx` (no global install):

```bash
npx motionboards-mcp
```

---

## Set up

### 1. Get a MotionBoards subscription

Sign up at [motionboards.vercel.app](https://motionboards.vercel.app). The full catalog needs an active plan (RM10/month limited time, normally RM100).

### 2. Generate an API key

Open MotionBoards → **Settings → API Keys → Create**. Give it a memorable name like `claude-code laptop`. Copy the key immediately — it's shown exactly once.

### 3. Add to Claude Code

```bash
claude mcp add motionboards --scope user --env MOTIONBOARDS_API_KEY=mb_… -- npx -y motionboards-mcp
```

Restart your Claude Code session. The six tools are now available.

---

## The 6 tools

| Tool       | What it does                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `credits`  | Show your MotionBoards balance and subscription status.                                           |
| `models`   | List the generation catalog (Veo, Nano Banana, Seedance, Sync Lipsync, ...). Filter by keyword.   |
| `upload`   | Push a local file or remote URL to MotionBoards Blob and get a public URL for use as input.      |
| `generate` | Submit a generation. Sync models return immediately; async (Veo) return polling identifiers.      |
| `status`   | Poll an async generation and fetch the output URL when ready.                                     |
| `boards`   | List your canvases, item counts, and the active board.                                            |

---

## How it actually feels

```
> what models can do image-to-video
calling models tool with filter:"i2v"
…
14 models available, including Veo 3.1 Fast I2V, Seedance 1.5 Pro I2V, Kling 2.5 Pro I2V, …

> upload /Users/me/photos/saturated_neon.png and use it as the start frame for veo 3.1 fast i2v with the prompt "the camera dollies in slowly while the lights flicker"
calling upload tool…
✓ uploaded — https://blob.vercel-storage.com/uploads/.../saturated_neon.png

calling generate tool with model:fal-ai/veo3.1/fast/image-to-video, inputImage:<url>, prompt:"…"
⏳ generation submitted (async)
   requestId: req_xxx
   modelId:   fal-ai/veo3.1/fast/image-to-video
   generationId: gen_yyy

> poll
calling status tool…
⏳ status: processing — running on fal.ai

> poll
calling status tool…
✓ generation complete
output: https://blob.vercel-storage.com/.../out.mp4

The asset is now in your generations history. Open MotionBoards to drag it onto your canvas.
```

---

## Configuration

| Variable                  | Default                              | Notes                                              |
| ------------------------- | ------------------------------------ | -------------------------------------------------- |
| `MOTIONBOARDS_API_KEY`    | _(required)_                         | Personal API key from MotionBoards Settings.       |
| `MOTIONBOARDS_BASE_URL`   | `https://motionboards.vercel.app`    | Override for self-hosted / staging deployments.    |

---

## Tool reference

### `credits`

No arguments. Returns account name, email, current credit balance (in cents and RM), and subscription status.

### `models`

```ts
{
  filter?: string;   // substring match against id, name, type, provider
  limit?: number;    // default 50, max 200
}
```

### `upload`

```ts
{
  source: string;       // absolute local path OR https:// URL
  filename?: string;    // override displayed filename
}
```

Returns a public Vercel Blob URL.

### `generate`

```ts
{
  model: string;                              // e.g. 'fal-ai/nano-banana-2'
  prompt?: string;
  inputImage?: string;                        // single-image URL
  inputImages?: string[];                     // multi-image URLs
  startFrame?: string;                        // for s2e (start-end-frame) models
  endFrame?: string;
  inputAudio?: string;                        // for lipsync / voice-clone
  generationOptions?: Record<string, unknown>; // model-specific (aspect_ratio, duration, ...)
}
```

Sync models return `outputUrl` immediately. Async (Veo) return `{ requestId, modelId, generationId }` for polling.

### `status`

```ts
{
  requestId: string;       // from generate
  modelId: string;         // from generate
  generationId: string;    // from generate
}
```

Returns `processing`, `completed` (with `outputUrl`), or `failed`.

### `boards`

No arguments. Lists your canvases with item counts and the active board id.

---

## Why this exists

MotionBoards has 30+ models in one canvas. Claude Code is where I draft, plan, and iterate. Bridging them means I can describe what I want in the same place I write the code that uses it — and the visual asset is a click away.

The tool is small on purpose. Six verbs, one bearer token, no daemon. The MotionBoards REST API does the heavy lifting; this is just the wrapper that makes it feel native to Claude Code.

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Adletic](https://adleticagency.com) on top of [MotionBoards](https://motionboards.vercel.app). Same family as [`claude-whatsapp-mcp`](https://github.com/ferazfhansurie/claude-whatsapp-mcp), [`claude-ops`](https://github.com/ferazfhansurie/claude-ops), and [AIOS](https://github.com/ferazfhansurie/aios).

# claude-motion

> AI image and video generation inside Claude Code. Veo, Nano Banana, Seedance, Sync Lipsync, and 25+ other models. The result lands directly on your MotionBoards canvas.

[![npm](https://img.shields.io/npm/v/claude-motion.svg)](https://www.npmjs.com/package/claude-motion)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

You're in your terminal. You ask Claude for a 5-second clip from a still image. Claude calls `generate`, MotionBoards runs Veo 3.1, the asset lands on your canvas. You open MotionBoards to refine, edit, sequence — every model in MotionBoards' catalog is available without leaving Claude Code.

Six tools. Bring-your-own MotionBoards subscription. Nothing else to set up.

---

## What you can do

- "make a 5s i2v from this image" — `upload` → `generate` (Veo / Seedance I2V) → asset lands on your canvas
- "lipsync this photo to this audio" — `upload` ×2 → `generate` (Sync Lipsync) → canvas
- "edit this image with nano banana — add a neon background" — `upload` → `generate` (Nano Banana) → canvas
- "fill in motion between these two frames" — `upload` ×2 → `generate` (Veo 3.1 first-last-frame) → canvas
- "what's my credit balance" — `credits`
- "what models do image-to-video" — `models filter:i2v`

---

## Install

```bash
npm install -g claude-motion
```

Or run with `npx` (no global install):

```bash
npx claude-motion
```

---

## Set up

### 1. Get a MotionBoards subscription

Sign up at [motionboards.vercel.app](https://motionboards.vercel.app). The full catalog needs an active plan (RM10/month limited time, normally RM100).

### 2. Generate an API key

Open MotionBoards → **Settings → API Keys → Create**. Give it a name like `claude-code laptop`. Copy the key immediately — it's shown exactly once.

### 3. Add to Claude Code

```bash
claude mcp add motion --scope user --env MOTIONBOARDS_API_KEY=mb_… -- npx -y claude-motion
```

Restart your Claude Code session. The six tools are now available.

### Or — Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

```json
{
  "mcpServers": {
    "motion": {
      "command": "npx",
      "args": ["-y", "claude-motion"],
      "env": {
        "MOTIONBOARDS_API_KEY": "mb_…"
      }
    }
  }
}
```

Fully quit Claude Desktop and reopen.

---

## The 6 tools

| Tool       | What it does                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `credits`  | Show MotionBoards balance and subscription status.                                                 |
| `models`   | List the generation catalog (Veo, Nano Banana, Seedance, Sync Lipsync, ...). Filter by keyword.    |
| `upload`   | Push a local file or remote URL to MotionBoards Blob and get a public URL for use as input.        |
| `generate` | Submit a generation. Sync models return the output URL immediately. Async (Veo) returns polling.   |
| `status`   | Poll an async generation and fetch the output URL when ready.                                      |
| `boards`   | List your canvases, item counts, and the active board.                                             |

---

## How it actually feels

```
> what models can do image-to-video
calling models filter:"i2v"
14 models — Veo 3.1 Fast I2V, Seedance 2.0 Pro I2V, Wan 2.2 Animate, …

> upload /Users/me/photos/saturated_neon.png and use it as the start frame for veo 3.1 fast i2v with the prompt "the camera dollies in slowly while the lights flicker"
calling upload tool…
✓ uploaded — https://blob.vercel-storage.com/.../saturated_neon.png

calling generate tool…
⏳ generation submitted (async)
   requestId: req_xxx · modelId: veo-3.1-fast-generate-preview/i2v

> poll
calling status tool…
✓ generation complete
output: https://blob.vercel-storage.com/.../out.mp4
✓ placed on board "My Project"

The asset is now live on your MotionBoards canvas. Open it to refine.
```

---

## Auto-place on canvas (default on)

Every successful generation auto-appears on your active MotionBoards canvas. No manual drag.

- Sync models (Nano Banana, Flux Schnell, Lipsync) place immediately.
- Async models (Veo) place when you call `status` and the job completes.

To disable for a single call, pass `add_to_board: false`. To target a specific canvas, pass `board_id`.

---

## Configuration

| Variable                  | Default                              | Notes                                              |
| ------------------------- | ------------------------------------ | -------------------------------------------------- |
| `MOTIONBOARDS_API_KEY`    | _(required)_                         | Personal API key from MotionBoards Settings.       |
| `MOTIONBOARDS_BASE_URL`   | `https://motionboards.vercel.app`    | Override for self-hosted / staging deployments.    |

---

## Tool reference

### `credits`
No arguments. Returns account name, email, current credit balance, and subscription status.

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
  filename?: string;
}
```

### `generate`
```ts
{
  model: string;
  prompt?: string;
  inputImage?: string;
  inputImages?: string[];
  startFrame?: string;
  endFrame?: string;
  inputAudio?: string;
  generationOptions?: Record<string, unknown>;
  add_to_board?: boolean;   // default true — auto-place on active canvas
  board_id?: string;        // override target canvas
}
```

### `status`
```ts
{
  requestId: string;
  modelId: string;
  generationId: string;
  add_to_board?: boolean;   // default true
  board_id?: string;
}
```

### `boards`
No arguments. Lists your canvases with item counts and the active board id.

---

## Why this exists

MotionBoards has 30+ AI generation models in one canvas. Claude Code is where I draft, plan, and iterate. Bridging them means I can describe what I want in the same place I write the code that uses it — and the visual asset lands on the canvas without me leaving the terminal.

The tool is small on purpose. Six verbs, one bearer token, no daemon.

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Adletic](https://adleticagency.com) on top of [MotionBoards](https://motionboards.vercel.app). Same family as [`claude-whatsapp-mcp`](https://github.com/ferazfhansurie/claude-whatsapp-mcp), [`claude-ops`](https://github.com/ferazfhansurie/claude-ops), and [AIOS](https://github.com/ferazfhansurie/aios).

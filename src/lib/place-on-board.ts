import { apiCall, type ClientConfig } from "./client.js";

/**
 * After a successful generation, append a BoardItem to the user's active
 * MotionBoards canvas so the asset shows up in the UI without a manual drag.
 *
 * Mirrors the BoardItem shape used by the MotionBoards web app
 * (src/lib/store.ts → BoardItem).
 */

interface BoardItem {
  id: string;
  type: "image" | "video" | "audio" | "generation";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  prompt?: string;
  model?: string;
  modelName?: string;
  status?: "completed";
  outputUrl?: string;
  outputType?: "image" | "video" | "audio";
  cost?: string;
  createdAt?: string;
}

interface Board {
  id: string;
  name?: string;
  items?: BoardItem[];
}

interface BoardsState {
  boards?: Board[];
  activeBoardId?: string;
  selectedModelId?: string;
}

export interface PlaceArgs {
  outputUrl: string;
  outputType: "image" | "video" | "audio";
  modelId: string;
  modelName?: string;
  prompt?: string;
  cost?: string;
  /** If provided, place on this board id. Otherwise use activeBoardId, or the first board. */
  targetBoardId?: string;
}

export interface PlaceResult {
  ok: boolean;
  boardId?: string;
  boardName?: string;
  itemId?: string;
  reason?: string;
}

export async function placeAssetOnBoard(
  config: ClientConfig,
  args: PlaceArgs,
): Promise<PlaceResult> {
  // 1. Fetch current boards state
  const fetchRes = await apiCall<BoardsState>(config, "/api/boards");
  if (!fetchRes.ok || !fetchRes.data) {
    return { ok: false, reason: fetchRes.error || "Could not load boards." };
  }
  const state = fetchRes.data as BoardsState;
  const boards = Array.isArray(state.boards) ? state.boards : [];
  if (boards.length === 0) {
    return { ok: false, reason: "No boards exist. Open MotionBoards and create one first." };
  }

  // 2. Pick the target board
  const targetId = args.targetBoardId ?? state.activeBoardId ?? boards[0].id;
  const board = boards.find((b) => b.id === targetId);
  if (!board) {
    return { ok: false, reason: `Board '${targetId}' not found.` };
  }

  if (!Array.isArray(board.items)) board.items = [];

  // 3. Build the new item — sized + positioned to not collide
  const isVideo = args.outputType === "video";
  const isAudio = args.outputType === "audio";
  const width = isAudio ? 200 : 200;
  const height = isAudio ? 60 : isVideo ? 130 : 200;
  const { x, y } = pickFreePosition(board.items, width, height);

  const itemId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newItem: BoardItem = {
    id: itemId,
    type: "generation",
    x,
    y,
    width,
    height,
    src: args.outputUrl,
    outputUrl: args.outputUrl,
    outputType: args.outputType,
    status: "completed",
    model: args.modelId,
    modelName: args.modelName,
    prompt: args.prompt,
    cost: args.cost,
    createdAt: new Date().toISOString(),
  };

  board.items.push(newItem);

  // 4. POST the updated state back
  const saveRes = await apiCall(config, "/api/boards", {
    method: "POST",
    body: state,
    timeoutMs: 30_000,
  });
  if (!saveRes.ok) {
    return { ok: false, reason: saveRes.error || "Could not save updated boards." };
  }

  return {
    ok: true,
    boardId: board.id,
    boardName: board.name,
    itemId,
  };
}

/**
 * Pick a non-overlapping position for a new item.
 * Strategy: scan a coarse grid right of the existing items' bounding box.
 * Falls back to (50, 50) if there's nothing on the board yet.
 */
function pickFreePosition(items: BoardItem[], w: number, h: number): { x: number; y: number } {
  if (items.length === 0) return { x: 50, y: 50 };

  // Find rightmost edge + bottom edge
  let maxRight = 0;
  let topMost = Infinity;
  for (const it of items) {
    const right = (it.x ?? 0) + (it.width ?? 200);
    if (right > maxRight) maxRight = right;
    if ((it.y ?? 0) < topMost) topMost = it.y ?? 0;
  }
  // Drop the new item to the right of the bounding box with a 24px gap
  return {
    x: Math.max(50, maxRight + 24),
    y: Math.max(50, topMost === Infinity ? 50 : topMost),
  };
}

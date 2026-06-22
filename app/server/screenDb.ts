/** État écran TV en mémoire (rejoint au redémarrage serveur). */

export const SCREEN_PATHS = [
  "/wall",
  "/planning",
  "/timeline",
  "/countdown",
  "/classement",
  "/retrospective",
] as const;

export type ScreenPath = (typeof SCREEN_PATHS)[number];

export type ScreenCommand =
  | { type: "navigate"; path: ScreenPath }
  | {
      type: "scroll";
      direction: "up" | "down" | "top" | "bottom";
      amount?: number;
    }
  | { type: "volume"; value: number }
  | { type: "zoom"; level: number }
  | { type: "fullscreen" }
  | { type: "action"; name: "retrospective:start" | "confetti:burst" };

export interface ScreenState {
  path: ScreenPath;
  volume: number;
  zoom: number;
}

let state: ScreenState = { path: "/wall", volume: 0.5, zoom: 1 };

export function getScreenState(): ScreenState {
  return { ...state };
}

export function applyScreenCommand(cmd: ScreenCommand): ScreenState {
  if (cmd.type === "navigate") state.path = cmd.path;
  if (cmd.type === "volume")
    state.volume = Math.max(0, Math.min(1, cmd.value));
  if (cmd.type === "zoom")
    state.zoom = Math.max(0.5, Math.min(2, cmd.level));
  return getScreenState();
}

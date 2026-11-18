// Shared (client + server) types, defaults and presets. No node-only imports here.

export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";

export interface CaptionPrefs {
  enabled: boolean;
  font: string;
  size: number; // percent of base size
  uppercase: boolean;
  wordsPerLine: number;
  textColor: string;
  highlightColor: string;
  highlightMode: "color" | "box" | "scale" | "none";
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  popIn: boolean;
  positionY: number; // percent from the top of the frame (centre of the text)
}

export interface HookPrefs {
  enabled: boolean;
  duration: number;
  style: "box" | "text";
  boxColor: string;
  textColor: string;
  positionY: number;
  size: number;
}

export interface EditPrefs {
  aspect: Aspect;
  reframe: "crop" | "blur";
  focusX: number; // 0-100, horizontal focus for crop reframing
  quality: "draft" | "standard" | "high";
  captions: CaptionPrefs;
  hook: HookPrefs;
  progressBar: {
    enabled: boolean;
    color: string;
    position: "top" | "bottom";
    thickness: number;
  };
  zoom: { mode: "none" | "slow" | "punch"; intensity: number };
  handle: { enabled: boolean; text: string; corner: "tl" | "tr" | "bl" | "br" };
  audio: { normalize: boolean; fadeOut: boolean };
  notes: string;
}

export interface AnalysisPrefs {
  minLen: number;
  maxLen: number;
  count: number;
  focus: string[];
  notes: string;
  language: string;
}

export const FOCUS_OPTIONS = [
  { id: "emotional", label: "Emotional / heartfelt" },
  { id: "funny", label: "Funny / laugh-out-loud" },
  { id: "controversial", label: "Hot takes & controversy" },
  { id: "insightful", label: "Surprising insights" },
  { id: "story", label: "Storytelling payoffs" },
  { id: "actionable", label: "Actionable advice" },
  { id: "conflict", label: "Conflict & tension" },
];

export const DEFAULT_ANALYSIS_PREFS: AnalysisPrefs = {
  minLen: 25,
  maxLen: 75,
  count: 12,
  focus: ["emotional", "funny", "insightful"],
  notes: "",
  language: "",
};

export const FONT_OPTIONS = [
  { id: "Montserrat Black", label: "Montserrat Black", file: "Montserrat_900Black.ttf", bold: false },
  { id: "Montserrat ExtraBold", label: "Montserrat ExtraBold", file: "Montserrat_800ExtraBold.ttf", bold: false },
  { id: "Anton", label: "Anton (tall impact)", file: "Anton_400Regular.ttf", bold: false },
  { id: "Bangers", label: "Bangers (comic)", file: "Bangers_400Regular.ttf", bold: false },
  { id: "Poppins ExtraBold", label: "Poppins ExtraBold", file: "Poppins_800ExtraBold.ttf", bold: false },
  { id: "Poppins", label: "Poppins Bold", file: "Poppins_700Bold.ttf", bold: true },
  { id: "Montserrat", label: "Montserrat Bold", file: "Montserrat_700Bold.ttf", bold: true },
];

export const DEFAULT_EDIT_PREFS: EditPrefs = {
  aspect: "9:16",
  reframe: "blur",
  focusX: 50,
  quality: "standard",
  captions: {
    enabled: true,
    font: "Montserrat Black",
    size: 100,
    uppercase: true,
    wordsPerLine: 3,
    textColor: "#FFFFFF",
    highlightColor: "#FFE600",
    highlightMode: "color",
    outlineColor: "#000000",
    outlineWidth: 6,
    shadow: 2,
    popIn: true,
    positionY: 66,
  },
  hook: {
    enabled: true,
    duration: 3.5,
    style: "box",
    boxColor: "#FFFFFF",
    textColor: "#111111",
    positionY: 15,
    size: 100,
  },
  progressBar: { enabled: true, color: "#FFE600", position: "bottom", thickness: 10 },
  zoom: { mode: "punch", intensity: 10 },
  handle: { enabled: false, text: "@yourhandle", corner: "br" },
  audio: { normalize: true, fadeOut: true },
  notes: "",
};

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  prefs: DeepPartial<EditPrefs>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "viral",
    name: "Viral Pop",
    description: "Bold uppercase captions, yellow active word, hook banner, punch-in zooms.",
    prefs: {},
  },
  {
    id: "clean",
    name: "Clean Minimal",
    description: "Calm sentence-case captions, no zoom, subtle progress bar. Great for podcasts.",
    prefs: {
      captions: {
        font: "Poppins",
        size: 85,
        uppercase: false,
        wordsPerLine: 5,
        highlightMode: "color",
        highlightColor: "#7DD3FC",
        outlineWidth: 4,
        shadow: 3,
        popIn: false,
        positionY: 74,
      },
      hook: { style: "text", textColor: "#FFFFFF", boxColor: "#000000", duration: 3 },
      progressBar: { color: "#FFFFFF", thickness: 6 },
      zoom: { mode: "none", intensity: 8 },
    },
  },
  {
    id: "neon",
    name: "Neon Energy",
    description: "Tall Anton letters, hot-pink highlight boxes and a slow cinematic push-in.",
    prefs: {
      captions: {
        font: "Anton",
        size: 115,
        wordsPerLine: 2,
        highlightMode: "box",
        highlightColor: "#FF2E93",
        outlineWidth: 5,
        positionY: 62,
      },
      hook: { boxColor: "#FF2E93", textColor: "#FFFFFF" },
      progressBar: { color: "#FF2E93" },
      zoom: { mode: "slow", intensity: 12 },
    },
  },
  {
    id: "comic",
    name: "Comic Fun",
    description: "Playful Bangers font with scale-up highlighted words. Best for funny moments.",
    prefs: {
      captions: {
        font: "Bangers",
        size: 120,
        wordsPerLine: 3,
        highlightMode: "scale",
        highlightColor: "#4ADE80",
        outlineWidth: 7,
        positionY: 64,
      },
      hook: { boxColor: "#FFE600", textColor: "#111111" },
      progressBar: { color: "#4ADE80" },
      zoom: { mode: "punch", intensity: 12 },
    },
  },
  {
    id: "captions-only",
    name: "Captions Only",
    description: "Just subtitles. No hook, no zoom, no progress bar, original framing.",
    prefs: {
      hook: { enabled: false },
      progressBar: { enabled: false },
      zoom: { mode: "none" },
    },
  },
];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergePrefs<T>(base: T, patch: unknown): T {
  if (!isObj(patch) || !isObj(base)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in out)) continue;
    const cur = out[k];
    if (isObj(cur)) out[k] = mergePrefs(cur, v);
    else if (v !== undefined && v !== null && typeof v === typeof cur) out[k] = v;
  }
  return out as T;
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const hex = (c: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fb);

export function normalizeEditPrefs(input: unknown): EditPrefs {
  const p = mergePrefs(structuredClone(DEFAULT_EDIT_PREFS), input);
  const d = DEFAULT_EDIT_PREFS;
  if (!["9:16", "1:1", "4:5", "16:9"].includes(p.aspect)) p.aspect = d.aspect;
  if (!["crop", "blur"].includes(p.reframe)) p.reframe = d.reframe;
  if (!["draft", "standard", "high"].includes(p.quality)) p.quality = d.quality;
  p.focusX = clamp(p.focusX, 0, 100);
  const c = p.captions;
  if (!FONT_OPTIONS.some((f) => f.id === c.font)) c.font = d.captions.font;
  c.size = clamp(c.size, 50, 200);
  c.wordsPerLine = Math.round(clamp(c.wordsPerLine, 1, 8));
  c.outlineWidth = clamp(c.outlineWidth, 0, 14);
  c.shadow = clamp(c.shadow, 0, 10);
  c.positionY = clamp(c.positionY, 5, 95);
  c.textColor = hex(c.textColor, d.captions.textColor);
  c.highlightColor = hex(c.highlightColor, d.captions.highlightColor);
  c.outlineColor = hex(c.outlineColor, d.captions.outlineColor);
  if (!["color", "box", "scale", "none"].includes(c.highlightMode)) c.highlightMode = "color";
  const h = p.hook;
  h.duration = clamp(h.duration, 1, 10);
  h.positionY = clamp(h.positionY, 5, 90);
  h.size = clamp(h.size, 50, 200);
  h.boxColor = hex(h.boxColor, d.hook.boxColor);
  h.textColor = hex(h.textColor, d.hook.textColor);
  if (!["box", "text"].includes(h.style)) h.style = "box";
  p.progressBar.color = hex(p.progressBar.color, d.progressBar.color);
  p.progressBar.thickness = clamp(p.progressBar.thickness, 2, 30);
  if (!["top", "bottom"].includes(p.progressBar.position)) p.progressBar.position = "bottom";
  if (!["none", "slow", "punch"].includes(p.zoom.mode)) p.zoom.mode = "none";
  p.zoom.intensity = clamp(p.zoom.intensity, 3, 25);
  if (!["tl", "tr", "bl", "br"].includes(p.handle.corner)) p.handle.corner = "br";
  p.handle.text = String(p.handle.text).slice(0, 40);
  p.notes = String(p.notes ?? "").slice(0, 600);
  return p;
}

export function normalizeAnalysisPrefs(input: unknown): AnalysisPrefs {
  const p = mergePrefs(structuredClone(DEFAULT_ANALYSIS_PREFS), input);
  if (isObj(input) && Array.isArray(input.focus)) p.focus = input.focus.map(String).slice(0, 10);
  p.minLen = clamp(Math.round(p.minLen), 10, 170);
  p.maxLen = clamp(Math.round(p.maxLen), p.minLen + 5, 180);
  p.count = clamp(Math.round(p.count), 1, 40);
  p.notes = String(p.notes ?? "").slice(0, 800);
  p.language = String(p.language ?? "").slice(0, 8);
  return p;
}

// ---- API shapes used by the UI ----

export interface RenderDTO {
  id: string;
  clipId: string;
  kind: "raw" | "edited" | "preview";
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  error: string | null;
  createdAt: string;
}

export interface ClipDTO {
  id: string;
  projectId: string;
  startSec: number;
  endSec: number;
  title: string;
  hook: string;
  reason: string;
  score: number;
  emotions: string[];
  category: string;
  text: string;
  renders: RenderDTO[];
}

export interface ProjectDTO {
  id: string;
  name: string;
  sourceName: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  status: "uploading" | "uploaded" | "processing" | "ready" | "error";
  stage: string;
  progress: number;
  error: string | null;
  analysisPrefs: AnalysisPrefs | null;
  hasTranscript: boolean;
  createdAt: string;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? h + ":" : ""}${mm}:${String(r).padStart(2, "0")}`;
}

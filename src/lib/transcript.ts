import fs from "node:fs";
import path from "node:path";
import { projectDir } from "./paths";

export interface TWord {
  w: string;
  s: number;
  e: number;
}
export interface TSegment {
  start: number;
  end: number;
  text: string;
}
export interface Transcript {
  language: string;
  duration: number;
  segments: TSegment[];
  words: TWord[];
}

const cache = new Map<string, { mtime: number; t: Transcript }>();

export function transcriptFile(projectId: string) {
  return path.join(projectDir(projectId), "transcript.json");
}

export function hasTranscript(projectId: string): boolean {
  return fs.existsSync(transcriptFile(projectId));
}

export function saveTranscript(projectId: string, t: Transcript) {
  fs.writeFileSync(transcriptFile(projectId), JSON.stringify(t));
  cache.delete(projectId);
}

export function loadTranscript(projectId: string): Transcript | null {
  const f = transcriptFile(projectId);
  if (!fs.existsSync(f)) return null;
  const mtime = fs.statSync(f).mtimeMs;
  const hit = cache.get(projectId);
  if (hit && hit.mtime === mtime) return hit.t;
  const t = JSON.parse(fs.readFileSync(f, "utf8")) as Transcript;
  cache.set(projectId, { mtime, t });
  return t;
}

/** Binary search for the first word whose end is after `time`. */
function firstWordIndex(words: TWord[], time: number): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].e <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function wordsInRange(t: Transcript, start: number, end: number): TWord[] {
  const out: TWord[] = [];
  for (let i = firstWordIndex(t.words, start); i < t.words.length; i++) {
    const w = t.words[i];
    if (w.s >= end) break;
    out.push(w);
  }
  return out;
}

export function textInRange(t: Transcript, start: number, end: number): string {
  return wordsInRange(t, start, end)
    .map((w) => w.w)
    .join(" ");
}

import { chatJson } from "./ai";
import { FOCUS_OPTIONS, type AnalysisPrefs } from "./types";
import type { Transcript } from "./transcript";

export interface Candidate {
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  score: number;
  emotions: string[];
  category: string;
}

const WINDOW = 720; // seconds of transcript per LLM call
const STEP = 600; // windows overlap by 2 minutes so no moment is cut in half

const SYSTEM = `You are a senior short-form video editor and viral content strategist (TikTok, Instagram Reels, YouTube Shorts).
You read transcripts of long videos and pick the moments that will make strangers stop scrolling, watch to the end, and share.
What makes a great clip: a strong hook in the first 3 seconds (bold claim, question, tension, surprise), a clear emotional peak (laughter, vulnerability, anger, awe, shock), a mini story arc or curiosity gap with a payoff, and a natural ending. It must make sense with no outside context.
Be strict and honest with scores: 90+ is exceptional and rare, 70-89 is strong, below 55 should not be returned.
Always answer with a single JSON object and nothing else.`;

function fmtLine(start: number, text: string) {
  return `[${Math.round(start)}] ${text}`;
}

function buildWindows(t: Transcript) {
  const windows: { from: number; to: number; text: string }[] = [];
  const total = t.duration || t.segments.at(-1)?.end || 0;
  for (let from = 0; from < total; from += STEP) {
    const to = from + WINDOW;
    const segs = t.segments.filter((s) => s.start >= from && s.start < to && s.text);
    const words = segs.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
    if (words < 40) continue;
    windows.push({ from, to, text: segs.map((s) => fmtLine(s.start, s.text)).join("\n") });
    if (to >= total) break;
  }
  return windows;
}

function parseCandidates(raw: unknown): Candidate[] {
  const arr = (raw as { clips?: unknown[] })?.clips;
  if (!Array.isArray(arr)) return [];
  const out: Candidate[] = [];
  for (const c of arr as Record<string, unknown>[]) {
    const start = Number(c.start);
    const end = Number(c.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    out.push({
      start,
      end,
      title: String(c.title ?? "").slice(0, 120),
      hook: String(c.hook ?? "")
        .replace(/["“”]/g, "")
        .slice(0, 90),
      reason: String(c.reason ?? "").slice(0, 400),
      score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 0))),
      emotions: Array.isArray(c.emotions) ? c.emotions.map(String).slice(0, 4) : [],
      category: String(c.category ?? "").slice(0, 40),
    });
  }
  return out;
}

function snap(c: Candidate, t: Transcript, prefs: AnalysisPrefs): Candidate | null {
  const segs = t.segments;
  if (!segs.length) return null;
  let sIdx = 0;
  let eIdx = 0;
  let bs = Infinity;
  let be = Infinity;
  segs.forEach((s, i) => {
    const ds = Math.abs(s.start - c.start);
    if (ds < bs) {
      bs = ds;
      sIdx = i;
    }
    const de = Math.abs(s.end - c.end);
    if (de < be) {
      be = de;
      eIdx = i;
    }
  });
  if (eIdx < sIdx) eIdx = sIdx;
  // Never exceed the maximum length: walk the end back to a sentence boundary.
  while (eIdx > sIdx && segs[eIdx].end - segs[sIdx].start > prefs.maxLen) eIdx--;
  let start = segs[sIdx].start;
  let end = segs[eIdx].end;
  // Tighten with word-level timing when we have it.
  const first = t.words.find((w) => w.e > start - 0.2 && w.s >= start - 0.4);
  if (first) start = first.s;
  for (let i = t.words.length - 1; i >= 0; i--) {
    if (t.words[i].s <= end + 0.3) {
      if (t.words[i].e > end - 1.5) end = t.words[i].e;
      break;
    }
  }
  start = Math.max(0, start - 0.15);
  end = Math.min(t.duration || end + 1, end + 0.4);
  if (end - start < prefs.minLen * 0.6) return null;
  return { ...c, start: +start.toFixed(2), end: +end.toFixed(2) };
}

function overlapRatio(a: Candidate, b: Candidate) {
  const o = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (o <= 0) return 0;
  return o / Math.min(a.end - a.start, b.end - b.start);
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function findClips(
  t: Transcript,
  prefs: AnalysisPrefs,
  onProgress: (fraction: number) => void,
): Promise<Candidate[]> {
  const windows = buildWindows(t);
  if (!windows.length) throw new Error("The transcript is too short to analyse. Is there any speech in this video?");
  const focus = prefs.focus
    .map((id) => FOCUS_OPTIONS.find((f) => f.id === id)?.label ?? id)
    .join(", ");
  const perWindow = Math.min(6, Math.max(2, Math.ceil((prefs.count * 1.6) / windows.length) + 1));
  let done = 0;
  let lastError: unknown = null;

  const results = await pool(windows, 3, async (w) => {
    const user = `Excerpt of a longer video, covering ${Math.round(w.from)}s to ${Math.round(w.to)}s. Each line starts with its timestamp in seconds, like [123].

TRANSCRIPT:
${w.text}

TASK:
Find up to ${perWindow} of the best standalone clips in this excerpt (fewer, or none, if nothing is genuinely engaging).
- Each clip must be between ${prefs.minLen} and ${prefs.maxLen} seconds long.
- Start on the first line of the hook/idea, end right after the payoff. Never start or end mid-sentence.
- Use ONLY timestamps that appear in the transcript (start = timestamp of the first line, end = timestamp of the line AFTER the last line you want to include).
${focus ? `- The creator especially wants: ${focus}.` : ""}
${prefs.notes ? `- Extra creator instructions: ${prefs.notes}` : ""}
- "hook" is a punchy on-screen headline for the first seconds, max 8 words, no quotes, written in the same language as the transcript.
- "title" is a descriptive title. "reason" is one sentence on why it will perform. "emotions" is 1-3 words like funny, shocking, inspiring, heartbreaking. "category" is one word.

Return JSON: {"clips":[{"start":0,"end":0,"title":"","hook":"","reason":"","score":0,"emotions":[""],"category":""}]}`;
    try {
      const raw = await chatJson(SYSTEM, user);
      return parseCandidates(raw);
    } catch (e) {
      lastError = e;
      return [] as Candidate[];
    } finally {
      done++;
      onProgress(done / windows.length);
    }
  });

  const all = results.flat();
  if (!all.length && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));

  const snapped = all.map((c) => snap(c, t, prefs)).filter((c): c is Candidate => !!c && c.score >= 40);
  snapped.sort((a, b) => b.score - a.score);
  const accepted: Candidate[] = [];
  for (const c of snapped) {
    if (accepted.some((a) => overlapRatio(a, c) > 0.3)) continue;
    accepted.push(c);
    if (accepted.length >= prefs.count) break;
  }
  return accepted;
}

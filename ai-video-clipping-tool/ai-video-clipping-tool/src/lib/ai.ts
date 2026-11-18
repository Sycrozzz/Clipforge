import fs from "node:fs";
import { getAiConfig } from "./settings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url: string, init: () => RequestInit, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init());
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        lastErr = new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
        await sleep(Math.max(retryAfter * 1000, 1500 * (i + 1) ** 2));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function chatJson(system: string, user: string, temperature = 0.4): Promise<unknown> {
  const cfg = await getAiConfig();
  if (!cfg.apiKey) throw new Error("No API key configured. Open Settings and add one.");
  const body = (withFormat: boolean) =>
    JSON.stringify({
      model: cfg.chatModel,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(withFormat ? { response_format: { type: "json_object" } } : {}),
    });
  const call = (withFormat: boolean) =>
    fetchRetry(`${cfg.baseUrl}/chat/completions`, () => ({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: body(withFormat),
    }));
  let res = await call(true);
  if (res.status === 400) res = await call(false);
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const content: string = j.choices?.[0]?.message?.content ?? "";
  return extractJson(content);
}

export interface RawWord {
  word: string;
  start: number;
  end: number;
}
export interface RawSegment {
  start: number;
  end: number;
  text: string;
}

export async function transcribeAudioFile(
  file: string,
  language?: string,
): Promise<{ segments: RawSegment[]; words: RawWord[]; language: string }> {
  const cfg = await getAiConfig();
  if (!cfg.apiKey) throw new Error("No API key configured. Open Settings and add one.");
  const buf = await fs.promises.readFile(file);
  const build = (granular: boolean) => () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", cfg.transcribeModel);
    form.append("response_format", "verbose_json");
    if (granular) {
      form.append("timestamp_granularities[]", "word");
      form.append("timestamp_granularities[]", "segment");
    }
    if (language) form.append("language", language);
    return { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form } as RequestInit;
  };
  let res = await fetchRetry(`${cfg.baseUrl}/audio/transcriptions`, build(true));
  if (res.status === 400) res = await fetchRetry(`${cfg.baseUrl}/audio/transcriptions`, build(false));
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const segments: RawSegment[] = (j.segments ?? []).map((s: RawSegment) => ({
    start: Number(s.start),
    end: Number(s.end),
    text: String(s.text ?? "").trim(),
  }));
  let words: RawWord[] = (j.words ?? []).map((w: RawWord) => ({
    word: String(w.word ?? "").trim(),
    start: Number(w.start),
    end: Number(w.end),
  }));
  if (!segments.length && j.text) segments.push({ start: 0, end: words.at(-1)?.end ?? 1, text: String(j.text).trim() });
  if (!words.length) {
    // Provider gave no word timestamps – spread words evenly across each segment.
    words = [];
    for (const s of segments) {
      const parts = s.text.split(/\s+/).filter(Boolean);
      const step = (s.end - s.start) / Math.max(parts.length, 1);
      parts.forEach((p, i) => words.push({ word: p, start: s.start + i * step, end: s.start + (i + 1) * step }));
    }
  }
  return { segments, words, language: String(j.language ?? language ?? "") };
}

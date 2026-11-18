import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, projects, renders } from "@/db/schema";
import { runFfmpeg } from "./ffmpeg";
import { subDir } from "./paths";
import { transcribeAudioFile } from "./ai";
import { findClips } from "./analyze";
import { hasTranscript, loadTranscript, saveTranscript, type Transcript, type TWord } from "./transcript";
import type { AnalysisPrefs } from "./types";

const g = globalThis as typeof globalThis & { __clipforgeRunning?: Set<string> };
const running = (g.__clipforgeRunning ??= new Set<string>());

export function isRunning(projectId: string) {
  return running.has(projectId);
}

async function setStage(projectId: string, stage: string, progress: number) {
  const db = await getDb();
  await db
    .update(projects)
    .set({ stage, progress: Math.round(Math.min(100, Math.max(0, progress))) })
    .where(eq(projects.id, projectId));
}

const SEG_SECONDS = 600;

async function transcribeProject(projectId: string, sourcePath: string, duration: number, language: string) {
  const audioDir = subDir(projectId, "audio");
  for (const f of fs.readdirSync(audioDir)) fs.rmSync(path.join(audioDir, f), { force: true });

  await setStage(projectId, "Extracting audio", 1);
  let lastPct = 0;
  await runFfmpeg(
    [
      "-i",
      sourcePath,
      "-vn",
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "32k",
      "-f",
      "segment",
      "-segment_time",
      String(SEG_SECONDS),
      "-segment_list",
      "seglist.csv",
      "-segment_list_type",
      "csv",
      "-reset_timestamps",
      "1",
      "seg_%03d.mp3",
    ],
    {
      cwd: audioDir,
      onProgress: (sec) => {
        const pct = Math.min(1, sec / Math.max(duration, 1)) * 10;
        if (pct - lastPct >= 1) {
          lastPct = pct;
          void setStage(projectId, "Extracting audio", 1 + pct);
        }
      },
    },
  );

  const list = fs
    .readFileSync(path.join(audioDir, "seglist.csv"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [file, start] = l.split(",");
      return { file: path.join(audioDir, file), offset: Number(start) };
    });
  if (!list.length) throw new Error("Could not extract any audio from this video.");

  const total = list.length;
  let finished = 0;
  const parts: { segments: Transcript["segments"]; words: TWord[]; language: string }[] = new Array(total);
  let next = 0;
  await setStage(projectId, `Transcribing speech (0/${total})`, 12);
  await Promise.all(
    Array.from({ length: Math.min(3, total) }, async () => {
      while (next < total) {
        const i = next++;
        const { file, offset } = list[i];
        const r = await transcribeAudioFile(file, language || undefined);
        parts[i] = {
          language: r.language,
          segments: r.segments.map((s) => ({ start: s.start + offset, end: s.end + offset, text: s.text })),
          words: r.words
            .filter((w) => w.word)
            .map((w) => ({ w: w.word, s: w.start + offset, e: w.end + offset })),
        };
        finished++;
        await setStage(projectId, `Transcribing speech (${finished}/${total})`, 12 + (finished / total) * 53);
      }
    }),
  );

  const t: Transcript = {
    language: parts.find((p) => p.language)?.language ?? language,
    duration,
    segments: parts.flatMap((p) => p.segments).filter((s) => s.text),
    words: parts.flatMap((p) => p.words),
  };
  saveTranscript(projectId, t);
  fs.rmSync(audioDir, { recursive: true, force: true });
  return t;
}

/** Full pipeline: (transcribe if needed) -> find clips. Runs in the background. */
export function startPipeline(projectId: string, prefs: AnalysisPrefs) {
  if (running.has(projectId)) return;
  running.add(projectId);
  void (async () => {
    const db = await getDb();
    try {
      const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!p) return;
      await db
        .update(projects)
        .set({ status: "processing", error: null, progress: 0, stage: "Starting", analysisPrefs: prefs })
        .where(eq(projects.id, projectId));

      let t = hasTranscript(projectId) ? loadTranscript(projectId) : null;
      if (!t) t = await transcribeProject(projectId, p.sourcePath, p.durationSec, prefs.language);

      await setStage(projectId, "Finding the most engaging moments", 66);
      const found = await findClips(t, prefs, (f) => void setStage(projectId, "Finding the most engaging moments", 66 + f * 32));
      if (!found.length) {
        throw new Error("No strong clips were found. Try widening the length range or changing the focus.");
      }
      await db.delete(renders).where(eq(renders.projectId, projectId));
      await db.delete(clips).where(eq(clips.projectId, projectId));
      await db.insert(clips).values(
        found.map((c) => ({
          projectId,
          startSec: c.start,
          endSec: c.end,
          title: c.title,
          hook: c.hook,
          reason: c.reason,
          score: c.score,
          emotions: c.emotions,
          category: c.category,
        })),
      );
      await db
        .update(projects)
        .set({ status: "ready", stage: "Done", progress: 100, error: null })
        .where(eq(projects.id, projectId));
    } catch (e) {
      await db
        .update(projects)
        .set({ status: "error", error: e instanceof Error ? e.message : String(e) })
        .where(eq(projects.id, projectId));
    } finally {
      running.delete(projectId);
    }
  })();
}

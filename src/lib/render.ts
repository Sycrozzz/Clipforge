import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, projects, renders } from "@/db/schema";
import { runFfmpeg } from "./ffmpeg";
import { FONTS_DIR, projectDir, safeName, subDir } from "./paths";
import { buildAss, outputSize } from "./ass";
import { loadTranscript, wordsInRange, type Transcript } from "./transcript";
import { normalizeEditPrefs, type EditPrefs } from "./types";

const g = globalThis as typeof globalThis & { __clipforgeQueue?: { ids: string[]; busy: boolean } };
const queue = (g.__clipforgeQueue ??= { ids: [], busy: false });

export function enqueueRender(renderId: string) {
  queue.ids.push(renderId);
  void pump();
}

async function pump() {
  if (queue.busy) return;
  queue.busy = true;
  try {
    while (queue.ids.length) {
      const id = queue.ids.shift()!;
      await runRender(id);
    }
  } finally {
    queue.busy = false;
  }
}

function ensureFonts(projectId: string) {
  const dest = path.join(projectDir(projectId), "fonts");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(FONTS_DIR)) {
    const target = path.join(dest, f);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(FONTS_DIR, f), target);
  }
}

function zoomExpr(prefs: EditPrefs, t: Transcript | null, start: number, dur: number): string | null {
  const a = prefs.zoom.intensity / 100;
  if (prefs.zoom.mode === "slow") return `1+${a.toFixed(3)}*t/${dur.toFixed(2)}`;
  if (prefs.zoom.mode === "punch") {
    let bounds: [number, number][] = [];
    if (t) {
      bounds = t.segments
        .filter((s) => s.end > start && s.start < start + dur)
        .map((s) => [Math.max(0, s.start - start), Math.min(dur, s.end - start)] as [number, number]);
    }
    // Merge very short segments so we cut roughly every 3-6 seconds.
    const merged: [number, number][] = [];
    for (const b of bounds) {
      const last = merged[merged.length - 1];
      if (last && b[1] - last[0] < 3.2) last[1] = b[1];
      else merged.push([b[0], b[1]]);
    }
    let cuts = merged;
    if (cuts.length < 2) {
      cuts = [];
      for (let s = 0; s < dur; s += 3.5) cuts.push([s, Math.min(dur, s + 3.5)]);
    }
    const terms = cuts
      .filter((_, i) => i % 2 === 1)
      .slice(0, 60)
      .map(([s, e]) => `between(t,${s.toFixed(2)},${e.toFixed(2)})`);
    if (!terms.length) return null;
    return `1+${a.toFixed(3)}*(${terms.join("+")})`;
  }
  return null;
}

function buildFilter(opts: {
  prefs: EditPrefs;
  W: number;
  H: number;
  assRel: string;
  zoom: string | null;
}): string {
  const { prefs, W, H, assRel, zoom } = opts;
  const parts: string[] = [];
  if (prefs.reframe === "blur") {
    parts.push(
      "[0:v]fps=30,split=2[bg0][fg0]",
      `[bg0]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=luma_radius=28:luma_power=2,eq=brightness=-0.1[bg]`,
      `[fg0]scale=${W}:-2[fg]`,
      "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v0]",
    );
  } else {
    parts.push(
      `[0:v]fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-ow)*${(prefs.focusX / 100).toFixed(3)}:(ih-oh)/2,setsar=1[v0]`,
    );
  }
  let last = "v0";
  if (zoom) {
    parts.push(`[${last}]scale=w='trunc(${W}*(${zoom})/2)*2':h='trunc(${H}*(${zoom})/2)*2':eval=frame,crop=${W}:${H}[v1]`);
    last = "v1";
  }
  parts.push(`[${last}]ass=${assRel}:fontsdir=fonts[vout]`);
  return parts.join(";");
}

async function runRender(renderId: string) {
  const db = await getDb();
  const [r] = await db.select().from(renders).where(eq(renders.id, renderId));
  if (!r) return;
  const fail = async (msg: string) => {
    await db.update(renders).set({ status: "error", error: msg.slice(0, 600) }).where(eq(renders.id, renderId));
  };
  try {
    const [clip] = await db.select().from(clips).where(eq(clips.id, r.clipId));
    const [project] = await db.select().from(projects).where(eq(projects.id, r.projectId));
    if (!clip || !project) return fail("Clip or project no longer exists.");
    if (!fs.existsSync(project.sourcePath)) return fail("The source video file could not be found anymore.");

    await db.update(renders).set({ status: "rendering", progress: 1, error: null }).where(eq(renders.id, renderId));

    const settings = (r.settings ?? {}) as Record<string, unknown>;
    const previewSeconds = Number(settings.previewSeconds) || 0;
    const start = r.startSec;
    const fullDur = Math.max(1, r.endSec - r.startSec);
    const dur = r.kind === "preview" && previewSeconds ? Math.min(fullDur, previewSeconds) : fullDur;

    const outDir = subDir(r.projectId, r.kind === "preview" ? "previews" : "clips");
    const base = `${safeName(clip.title || "clip")}_${r.kind}_${r.id.slice(0, 6)}`;
    const outFile = path.join(outDir, `${base}.mp4`);
    let lastPct = 0;
    const onProgress = (sec: number) => {
      const pct = Math.min(99, Math.round((sec / dur) * 100));
      if (pct - lastPct >= 3) {
        lastPct = pct;
        void db.update(renders).set({ progress: pct }).where(eq(renders.id, renderId));
      }
    };

    if (r.kind === "raw") {
      const fast = settings.fast === true;
      const args = fast
        ? ["-ss", String(start), "-t", String(dur), "-i", project.sourcePath, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", outFile]
        : [
            "-ss", String(start), "-t", String(dur), "-i", project.sourcePath,
            "-map", "0:v:0", "-map", "0:a:0?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile,
          ];
      await runFfmpeg(args, { onProgress });
    } else {
      const prefs = normalizeEditPrefs(settings.prefs);
      if (r.kind === "preview") prefs.quality = "draft";
      const { w: W, h: H } = outputSize(prefs.aspect, prefs.quality);
      const t = loadTranscript(r.projectId);
      const words = t
        ? wordsInRange(t, start, start + dur).map((w) => ({ w: w.w, s: Math.max(0, w.s - start), e: Math.min(dur, w.e - start) }))
        : [];
      const hookText = String(settings.hookText ?? clip.hook ?? "");
      const ass = buildAss({ words, duration: dur, hookText, prefs, width: W, height: H });
      ensureFonts(r.projectId);
      const assRel = `clips/_${r.id.slice(0, 8)}.ass`;
      const pdir = projectDir(r.projectId);
      fs.mkdirSync(path.join(pdir, "clips"), { recursive: true });
      fs.writeFileSync(path.join(pdir, assRel), ass, "utf8");

      const filter = buildFilter({ prefs, W, H, assRel, zoom: zoomExpr(prefs, t, start, dur) });
      const q = r.kind === "preview" ? { preset: "ultrafast", crf: "27" } : prefs.quality === "draft" ? { preset: "ultrafast", crf: "26" } : prefs.quality === "high" ? { preset: "medium", crf: "17" } : { preset: "veryfast", crf: "21" };
      const af: string[] = [];
      if (prefs.audio.normalize) af.push("loudnorm=I=-14:TP=-1.5:LRA=11");
      if (prefs.audio.fadeOut && dur > 3) af.push(`afade=t=out:st=${(dur - 0.4).toFixed(2)}:d=0.4`);
      const args = [
        "-ss", String(start), "-t", String(dur), "-i", project.sourcePath,
        "-filter_complex", filter,
        "-map", "[vout]", "-map", "0:a:0?",
        ...(af.length ? ["-af", af.join(",")] : []),
        "-c:v", "libx264", "-preset", q.preset, "-crf", q.crf, "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart",
        outFile,
      ];
      try {
        await runFfmpeg(args, { cwd: pdir, onProgress });
      } finally {
        fs.rmSync(path.join(pdir, assRel), { force: true });
      }
    }

    if (r.kind === "preview") {
      // keep only the newest preview per clip
      const olds = await db.select().from(renders).where(and(eq(renders.clipId, r.clipId), eq(renders.kind, "preview")));
      for (const o of olds) {
        if (o.id !== r.id) {
          if (o.outputFile) fs.rmSync(o.outputFile, { force: true });
          await db.delete(renders).where(eq(renders.id, o.id));
        }
      }
    }
    await db.update(renders).set({ status: "done", progress: 100, outputFile: outFile }).where(eq(renders.id, renderId));
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  }
}

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { runFfmpeg } from "@/lib/ffmpeg";
import { subDir } from "@/lib/paths";
import { serveFile } from "@/lib/serve";

export const dynamic = "force-dynamic";

const g = globalThis as typeof globalThis & { __clipforgePreviews?: Map<string, Promise<void>> };
const inflight = (g.__clipforgePreviews ??= new Map<string, Promise<void>>());

// Generates (and caches) a small proxy of just the requested range, so any codec/container previews fine in the browser.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const start = Math.max(0, Number(url.searchParams.get("start")) || 0);
  const end = Number(url.searchParams.get("end")) || start + 30;
  if (end <= start || end - start > 400) return new Response("Bad range", { status: 400 });
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p || !fs.existsSync(p.sourcePath)) return new Response("Not found", { status: 404 });

  const dir = subDir(id, "proxy");
  const file = path.join(dir, `${start.toFixed(2)}_${end.toFixed(2)}.mp4`);
  if (!fs.existsSync(file)) {
    let job = inflight.get(file);
    if (!job) {
      const tmp = file.replace(/\.mp4$/, ".part.mp4");
      job = runFfmpeg(
        [
          "-ss", String(start), "-t", String(end - start), "-i", p.sourcePath,
          "-vf", "scale=-2:480", "-map", "0:v:0", "-map", "0:a:0?",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "29", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart", tmp,
        ],
      )
        .then(() => fs.renameSync(tmp, file))
        .finally(() => inflight.delete(file));
      inflight.set(file, job);
    }
    try {
      await job;
    } catch {
      return new Response("Preview failed", { status: 500 });
    }
  }
  return serveFile(req, file);
}

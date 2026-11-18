import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { probe } from "@/lib/ffmpeg";
import { projectDir } from "@/lib/paths";
import { toProjectDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return Response.json({ projects: rows.map(toProjectDTO) });
}

/**
 * Create a project.
 *  - { fileName, size } -> chunked browser upload follows (PUT /upload, POST /finalize)
 *  - { path }           -> use a video that already lives on this computer, no copy
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { fileName?: string; size?: number; path?: string; name?: string };
  const db = await getDb();

  if (body.path) {
    const p = body.path.trim().replace(/^"|"$/g, "");
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      return Response.json({ error: "That file path does not exist on this computer." }, { status: 400 });
    }
    let info;
    try {
      info = await probe(p);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Not a readable video file." }, { status: 400 });
    }
    if (!info.hasAudio) return Response.json({ error: "This video has no audio track, so there is no speech to analyse." }, { status: 400 });
    const fileName = path.basename(p);
    const [row] = await db
      .insert(projects)
      .values({
        name: body.name?.trim() || fileName.replace(/\.[^.]+$/, ""),
        sourcePath: p,
        sourceName: fileName,
        ownsSource: false,
        sizeBytes: fs.statSync(p).size,
        durationSec: info.durationSec,
        width: info.width,
        height: info.height,
        status: "uploaded",
      })
      .returning();
    return Response.json({ project: toProjectDTO(row) });
  }

  const fileName = (body.fileName || "video.mp4").replace(/[\\/]/g, "_");
  const [row] = await db
    .insert(projects)
    .values({
      name: body.name?.trim() || fileName.replace(/\.[^.]+$/, ""),
      sourcePath: "",
      sourceName: fileName,
      sizeBytes: Number(body.size) || 0,
      status: "uploading",
    })
    .returning();
  const ext = path.extname(fileName) || ".mp4";
  const dest = path.join(projectDir(row.id), `source${ext}`);
  fs.writeFileSync(dest, "");
  await db.update(projects).set({ sourcePath: dest }).where(eq(projects.id, row.id));
  return Response.json({ project: toProjectDTO({ ...row, sourcePath: dest }) });
}

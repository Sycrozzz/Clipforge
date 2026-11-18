import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { probe } from "@/lib/ffmpeg";
import { toProjectDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  const size = fs.statSync(p.sourcePath).size;
  if (p.sizeBytes && size !== p.sizeBytes) {
    return Response.json({ error: `Upload incomplete (${size} of ${p.sizeBytes} bytes).` }, { status: 400 });
  }
  try {
    const info = await probe(p.sourcePath);
    if (!info.hasAudio) throw new Error("This video has no audio track, so there is no speech to analyse.");
    const [row] = await db
      .update(projects)
      .set({ status: "uploaded", durationSec: info.durationSec, width: info.width, height: info.height, sizeBytes: size })
      .where(eq(projects.id, id))
      .returning();
    return Response.json({ project: toProjectDTO(row) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not read this video." }, { status: 400 });
  }
}

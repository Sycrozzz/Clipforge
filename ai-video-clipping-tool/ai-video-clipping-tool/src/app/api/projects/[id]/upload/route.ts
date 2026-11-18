import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";

export const dynamic = "force-dynamic";

// Chunked upload: the browser sends the file in slices; each slice is written at its offset.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const offset = Number(new URL(req.url).searchParams.get("offset") ?? 0);
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p || p.status !== "uploading") return Response.json({ error: "Upload not active" }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  const fh = await fs.promises.open(p.sourcePath, "r+");
  try {
    await fh.write(buf, 0, buf.length, offset);
  } finally {
    await fh.close();
  }
  return Response.json({ ok: true, received: offset + buf.length });
}

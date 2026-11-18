import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, projects, renders } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    startSec?: number;
    endSec?: number;
    hook?: string;
    title?: string;
  };
  const db = await getDb();
  const [c] = await db.select().from(clips).where(eq(clips.id, id));
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  const [p] = await db.select().from(projects).where(eq(projects.id, c.projectId));
  const set: Partial<typeof clips.$inferInsert> = {};
  let start = c.startSec;
  let end = c.endSec;
  if (typeof body.startSec === "number") start = Math.max(0, body.startSec);
  if (typeof body.endSec === "number") end = Math.min(p?.durationSec || body.endSec, body.endSec);
  if (end - start < 3) return Response.json({ error: "A clip must be at least 3 seconds long." }, { status: 400 });
  if (end - start > 300) return Response.json({ error: "A clip can be at most 5 minutes long." }, { status: 400 });
  set.startSec = +start.toFixed(2);
  set.endSec = +end.toFixed(2);
  if (typeof body.hook === "string") set.hook = body.hook.slice(0, 120);
  if (typeof body.title === "string") set.title = body.title.slice(0, 160);
  await db.update(clips).set(set).where(eq(clips.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(renders).where(eq(renders.clipId, id));
  await db.delete(clips).where(eq(clips.id, id));
  return Response.json({ ok: true });
}

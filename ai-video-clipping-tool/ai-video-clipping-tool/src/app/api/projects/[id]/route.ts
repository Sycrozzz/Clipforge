import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, projects, renders } from "@/db/schema";
import { loadProjectDetail } from "@/lib/dto";
import { projectDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = await loadProjectDetail(id);
  if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(detail);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const db = await getDb();
  if (body.name?.trim()) await db.update(projects).set({ name: body.name.trim().slice(0, 120) }).where(eq(projects.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) return Response.json({ ok: true });
  await db.delete(renders).where(eq(renders.projectId, id));
  await db.delete(clips).where(eq(clips.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  // Never delete a user's original video that we only referenced by path.
  fs.rmSync(projectDir(id), { recursive: true, force: true });
  return Response.json({ ok: true });
}

import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { renders } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [r] = await db.select().from(renders).where(eq(renders.id, id));
  if (r?.outputFile) fs.rmSync(r.outputFile, { force: true });
  await db.delete(renders).where(eq(renders.id, id));
  return Response.json({ ok: true });
}

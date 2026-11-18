import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { renders } from "@/db/schema";
import { serveFile } from "@/lib/serve";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [r] = await db.select().from(renders).where(eq(renders.id, id));
  if (!r || !r.outputFile || r.status !== "done") return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download") ? path.basename(r.outputFile) : undefined;
  return serveFile(req, r.outputFile, { download });
}

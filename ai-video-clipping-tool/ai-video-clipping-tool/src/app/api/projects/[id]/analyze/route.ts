import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { getAiConfig } from "@/lib/settings";
import { hasTranscript } from "@/lib/transcript";
import { isRunning, startPipeline } from "@/lib/pipeline";
import { normalizeAnalysisPrefs } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { prefs?: unknown; retranscribe?: boolean };
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) return Response.json({ error: "Not found" }, { status: 404 });
  if (isRunning(id)) return Response.json({ error: "Already running" }, { status: 409 });
  const cfg = await getAiConfig();
  if (!cfg.apiKey) {
    return Response.json({ error: "Add your AI API key in Settings first (needed for transcription and clip detection)." }, { status: 400 });
  }
  if (body.retranscribe && hasTranscript(id)) {
    const fs = await import("node:fs");
    const { transcriptFile } = await import("@/lib/transcript");
    fs.rmSync(transcriptFile(id), { force: true });
  }
  startPipeline(id, normalizeAnalysisPrefs(body.prefs));
  return Response.json({ ok: true });
}

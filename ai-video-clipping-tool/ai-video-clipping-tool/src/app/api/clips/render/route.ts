import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, renders } from "@/db/schema";
import { enqueueRender } from "@/lib/render";
import { setSetting } from "@/lib/settings";
import { normalizeEditPrefs } from "@/lib/types";
import { toRenderDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    clipIds?: string[];
    kind?: string;
    prefs?: unknown;
    hookTexts?: Record<string, string>;
    fast?: boolean;
    previewSeconds?: number;
  };
  const kind = body.kind === "raw" || body.kind === "preview" ? body.kind : "edited";
  const ids = (body.clipIds ?? []).filter((x) => typeof x === "string").slice(0, 60);
  if (!ids.length) return Response.json({ error: "No clips selected" }, { status: 400 });
  const db = await getDb();
  const rows = await db.select().from(clips).where(inArray(clips.id, ids));
  const prefs = normalizeEditPrefs(body.prefs);
  if (kind !== "raw") await setSetting("editPrefs", JSON.stringify(prefs));

  const created = [];
  for (const c of rows) {
    const settings: Record<string, unknown> =
      kind === "raw"
        ? { fast: body.fast === true }
        : { prefs, hookText: body.hookTexts?.[c.id] ?? c.hook, previewSeconds: kind === "preview" ? Math.min(20, Number(body.previewSeconds) || 8) : 0 };
    const [r] = await db
      .insert(renders)
      .values({ clipId: c.id, projectId: c.projectId, kind, settings, startSec: c.startSec, endSec: c.endSec })
      .returning();
    created.push(toRenderDTO(r));
    enqueueRender(r.id);
  }
  return Response.json({ renders: created });
}

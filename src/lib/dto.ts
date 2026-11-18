import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clips, projects, renders } from "@/db/schema";
import { hasTranscript, loadTranscript, textInRange } from "./transcript";
import type { ClipDTO, ProjectDTO, RenderDTO } from "./types";

type ProjectRow = typeof projects.$inferSelect;
type RenderRow = typeof renders.$inferSelect;

export function toProjectDTO(p: ProjectRow): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    sourceName: p.sourceName,
    sizeBytes: p.sizeBytes,
    durationSec: p.durationSec,
    width: p.width,
    height: p.height,
    status: p.status as ProjectDTO["status"],
    stage: p.stage,
    progress: p.progress,
    error: p.error,
    analysisPrefs: p.analysisPrefs ?? null,
    hasTranscript: hasTranscript(p.id),
    createdAt: p.createdAt.toISOString(),
  };
}

export function toRenderDTO(r: RenderRow): RenderDTO {
  return {
    id: r.id,
    clipId: r.clipId,
    kind: r.kind as RenderDTO["kind"],
    status: r.status as RenderDTO["status"],
    progress: r.progress,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function loadProjectDetail(id: string) {
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) return null;
  const clipRows = await db.select().from(clips).where(eq(clips.projectId, id)).orderBy(desc(clips.score), asc(clips.startSec));
  const renderRows = await db.select().from(renders).where(eq(renders.projectId, id)).orderBy(desc(renders.createdAt));
  const t = loadTranscript(id);
  const clipDtos: ClipDTO[] = clipRows.map((c) => ({
    id: c.id,
    projectId: c.projectId,
    startSec: c.startSec,
    endSec: c.endSec,
    title: c.title,
    hook: c.hook,
    reason: c.reason,
    score: c.score,
    emotions: c.emotions ?? [],
    category: c.category,
    text: t ? textInRange(t, c.startSec, c.endSec) : "",
    renders: renderRows.filter((r) => r.clipId === c.id).map(toRenderDTO),
  }));
  return { project: toProjectDTO(p), clips: clipDtos };
}

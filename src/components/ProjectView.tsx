"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtTime, type ClipDTO, type EditPrefs, type ProjectDTO, DEFAULT_EDIT_PREFS } from "@/lib/types";
import AnalysisForm from "./AnalysisForm";
import ClipCard from "./ClipCard";
import StyleStudio from "./StyleStudio";
import { Button, Card, Spinner, cx } from "./ui";

interface Detail {
  project: ProjectDTO;
  clips: ClipDTO[];
}

const STEPS = ["Extracting audio", "Transcribing speech", "Finding the most engaging moments"];

export default function ProjectView({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [studio, setStudio] = useState<string[] | null>(null);
  const [studioPrefs, setStudioPrefs] = useState<EditPrefs>(DEFAULT_EDIT_PREFS);
  const [sort, setSort] = useState<"score" | "time">("score");
  const [fast, setFast] = useState(false);
  const [reanalyze, setReanalyze] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setMissing(true);
      return null;
    }
    const j: Detail = await res.json();
    setData(j);
    return j;
  }, [id]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const j = await load();
      if (stop || !j) return;
      const active = j.project.status === "processing" || j.clips.some((c) => c.renders.some((r) => r.status === "queued" || r.status === "rendering"));
      timer.current = setTimeout(tick, active ? 1500 : 6000);
    };
    void tick();
    return () => {
      stop = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const clips = useMemo(() => {
    const list = [...(data?.clips ?? [])];
    if (sort === "time") list.sort((a, b) => a.startSec - b.startSec);
    return list;
  }, [data, sort]);

  if (missing) return <p className="text-center text-zinc-400">Project not found. <Link href="/" className="text-violet-300 underline">Back to projects</Link></p>;
  if (!data) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const { project } = data;
  const activeRenders = data.clips.flatMap((c) => c.renders).filter((r) => (r.kind !== "preview") && (r.status === "queued" || r.status === "rendering")).length;
  const sel = clips.filter((c) => selected.has(c.id));

  const toggle = (cid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });

  async function renderRaw(ids: string[]) {
    await fetch("/api/clips/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clipIds: ids, kind: "raw", fast }) });
    await load();
  }

  async function openStudio(ids: string[]) {
    const s = await (await fetch("/api/settings")).json();
    setStudioPrefs(s.editPrefs);
    setStudio(ids);
  }

  async function renderEdited(prefs: EditPrefs, hookTexts: Record<string, string>) {
    const ids = studio ?? [];
    await fetch("/api/clips/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clipIds: ids, kind: "edited", prefs, hookTexts }) });
    setStudio(null);
    await load();
  }

  const studioClips = studio ? data.clips.filter((c) => studio.includes(c.id)) : [];
  const stepIndex = Math.max(0, STEPS.findIndex((s) => project.stage.startsWith(s.split(" ")[0])));
  const showForm = project.status === "uploaded" || project.status === "error" || (project.status === "ready" && reanalyze);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← All projects</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-zinc-500">
              {fmtTime(project.durationSec)} · {project.width}×{project.height} · {(project.sizeBytes / 1e9).toFixed(2)} GB
            </p>
          </div>
          {project.status === "ready" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fetch("/api/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: id }) })}>
                📁 Open clips folder
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReanalyze((r) => !r)}>
                {reanalyze ? "Cancel" : "Search again with different wishes"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {project.status === "uploading" && <Card>This upload never finished. Please delete this project and import the video again.</Card>}

      {showForm && (
        <AnalysisForm
          project={project}
          onStarted={() => {
            setReanalyze(false);
            setSelected(new Set());
            void load();
          }}
        />
      )}

      {project.status === "processing" && (
        <Card className="mx-auto max-w-2xl py-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 text-2xl">🔍</div>
          <h2 className="text-lg font-bold">{project.stage || "Working…"}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">Listening to the whole video and hunting for the moments people will actually share. You can leave this page open or come back later, it keeps running.</p>
          <div className="mx-auto mt-6 h-2.5 max-w-md overflow-hidden rounded-full bg-white/10">
            <div className="shimmer h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, project.progress)}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-zinc-500">{project.progress}%</p>
          <ol className="mx-auto mt-6 flex max-w-md justify-between text-xs">
            {STEPS.map((s, i) => (
              <li key={s} className={cx("flex items-center gap-1.5", i <= stepIndex ? "text-violet-200" : "text-zinc-600")}>
                <span className={cx("h-2 w-2 rounded-full", i < stepIndex ? "bg-emerald-400" : i === stepIndex ? "bg-violet-400" : "bg-zinc-700")} />
                {["Audio", "Transcript", "Best moments"][i]}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {project.status === "ready" && !reanalyze && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{clips.length} clips found</h2>
              <p className="text-xs text-zinc-500">Tick the ones you like, then grab them untouched or style and subtitle them.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button className="text-zinc-400 hover:text-white" onClick={() => setSelected(new Set(clips.map((c) => c.id)))}>Select all</button>
              <span className="text-zinc-700">·</span>
              <button className="text-zinc-400 hover:text-white" onClick={() => setSelected(new Set())}>None</button>
              <select value={sort} onChange={(e) => setSort(e.target.value as "score" | "time")} className="ml-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-zinc-300">
                <option value="score">Best first</option>
                <option value="time">Timeline order</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {clips.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                projectId={id}
                selected={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                onChanged={() => void load()}
                onRaw={() => void renderRaw([c.id])}
                onEdit={() => void openStudio([c.id])}
              />
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0f]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="text-sm text-zinc-300">
                <strong>{sel.length}</strong> selected
                {activeRenders > 0 && (
                  <span className="ml-3 inline-flex items-center gap-2 text-xs text-amber-300">
                    <Spinner className="h-3 w-3" /> rendering {activeRenders}…
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-500" title="Instant, no re-encode. May start a second or two early at the nearest keyframe.">
                  <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-violet-500" /> instant cut
                </label>
                <Button disabled={!sel.length} onClick={() => void renderRaw(sel.map((c) => c.id))}>
                  ⬇ Unedited clips
                </Button>
                <Button variant="primary" disabled={!sel.length} onClick={() => void openStudio(sel.map((c) => c.id))}>
                  ✨ Edit & subtitle…
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {studio && studioClips.length > 0 && (
        <StyleStudio clips={studioClips} initial={studioPrefs} onClose={() => setStudio(null)} onRender={renderEdited} />
      )}
    </div>
  );
}

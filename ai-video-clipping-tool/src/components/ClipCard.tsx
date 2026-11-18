"use client";

import { useState } from "react";
import { fmtTime, type ClipDTO, type RenderDTO } from "@/lib/types";
import { Button, cx, inputCls, Spinner } from "./ui";

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? "#34d399" : score >= 70 ? "#a78bfa" : "#fbbf24";
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute text-sm font-black tabular-nums">{score}</span>
    </div>
  );
}

function RenderRow({ label, r }: { label: string; r: RenderDTO | undefined }) {
  if (!r) return null;
  if (r.status === "queued" || r.status === "rendering") {
    return (
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <Spinner className="h-3 w-3" />
        <span className="w-24 shrink-0">{r.status === "queued" ? `${label}: queued` : `${label}: ${r.progress}%`}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="shimmer h-full" style={{ width: `${Math.max(5, r.progress)}%` }} />
        </div>
      </div>
    );
  }
  if (r.status === "error") return <p className="text-xs text-red-300">{label} failed: {r.error}</p>;
  return null;
}

export default function ClipCard({
  clip,
  projectId,
  selected,
  onToggle,
  onChanged,
  onRaw,
  onEdit,
}: {
  clip: ClipDTO;
  projectId: string;
  selected: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onRaw: () => void;
  onEdit: () => void;
}) {
  const [src, setSrc] = useState<{ url: string; vertical: boolean; label: string } | null>(null);
  const [hook, setHook] = useState(clip.hook);
  const [expanded, setExpanded] = useState(false);
  const [trimError, setTrimError] = useState("");

  const latest = (kind: string) => clip.renders.find((r) => r.kind === kind);
  const raw = latest("raw");
  const edited = latest("edited");
  const dur = clip.endSec - clip.startSec;

  async function patch(body: Record<string, unknown>) {
    setTrimError("");
    const res = await fetch(`/api/clips/${clip.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setTrimError((await res.json()).error ?? "Failed");
    else onChanged();
    return res.ok;
  }

  const previewUrl = (s: number, e: number) => `/api/projects/${projectId}/preview?start=${s}&end=${e}`;

  const nudge = async (which: "startSec" | "endSec", d: number) => {
    const next = +(clip[which] + d).toFixed(2);
    const ok = await patch({ [which]: next });
    if (ok && src?.label === "Source preview") {
      const s = which === "startSec" ? next : clip.startSec;
      const e = which === "endSec" ? next : clip.endSec;
      setSrc({ ...src, url: previewUrl(s, e) });
    }
  };

  const preview = () => setSrc({ url: previewUrl(clip.startSec, clip.endSec), vertical: false, label: "Source preview" });

  const TrimBtn = ({ which, d }: { which: "startSec" | "endSec"; d: number }) => (
    <button onClick={() => nudge(which, d)} className="h-6 min-w-8 rounded-md bg-white/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-zinc-300 hover:bg-white/15">
      {d > 0 ? "+" : "−"}
      {Math.abs(d)}s
    </button>
  );

  return (
    <div className={cx("overflow-hidden rounded-2xl border bg-[#12121a]/90 transition", selected ? "border-violet-400/60 shadow-lg shadow-violet-950/40" : "border-white/[0.07]")}>
      <div className="grid gap-0 md:grid-cols-[300px_1fr]">
        <div className="relative flex min-h-[200px] items-center justify-center bg-black">
          {src ? (
            <video key={src.url} src={src.url} controls autoPlay className={cx("max-h-[420px] w-full bg-black", src.vertical && "max-w-[236px]")} />
          ) : (
            <button onClick={preview} className="group flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950/50 to-pink-950/30 p-6 text-zinc-300 transition hover:text-white">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-xl transition group-hover:scale-110 group-hover:bg-white/20">▶</span>
              <span className="text-xs">Preview this moment</span>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {fmtTime(clip.startSec)} – {fmtTime(clip.endSec)}
              </span>
            </button>
          )}
          {src && (
            <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">{src.label}</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1.5 h-4 w-4 shrink-0 accent-violet-500" aria-label="Select clip" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-zinc-100">{clip.title || "Untitled moment"}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {clip.emotions.map((e) => (
                  <span key={e} className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-pink-200">
                    {e}
                  </span>
                ))}
                {clip.category && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-zinc-400">{clip.category}</span>}
              </div>
            </div>
            <ScoreRing score={clip.score} />
          </div>

          {clip.reason && <p className="text-sm leading-relaxed text-zinc-400">{clip.reason}</p>}

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Hook headline</p>
            <input
              className={inputCls + " py-2"}
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              onBlur={() => hook !== clip.hook && patch({ hook })}
              placeholder="Attention-grabbing headline shown at the start"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
            <div className="flex items-center gap-1">
              <span className="mr-1 text-zinc-500">Start {fmtTime(clip.startSec)}</span>
              <TrimBtn which="startSec" d={-1} />
              <TrimBtn which="startSec" d={1} />
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-zinc-500">End {fmtTime(clip.endSec)}</span>
              <TrimBtn which="endSec" d={-1} />
              <TrimBtn which="endSec" d={1} />
              <TrimBtn which="endSec" d={5} />
            </div>
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-semibold tabular-nums text-zinc-300">{Math.round(dur)}s</span>
          </div>
          {trimError && <p className="text-xs text-red-300">{trimError}</p>}

          {clip.text && (
            <button onClick={() => setExpanded((x) => !x)} className="text-left">
              <p className={cx("text-xs leading-relaxed text-zinc-500", !expanded && "line-clamp-2")}>“{clip.text}”</p>
            </button>
          )}

          <div className="space-y-1.5">
            <RenderRow label="Unedited" r={raw} />
            <RenderRow label="Edited" r={edited} />
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={onRaw} disabled={raw?.status === "queued" || raw?.status === "rendering"}>
              ⬇ Unedited clip
            </Button>
            <Button size="sm" variant="primary" onClick={onEdit} disabled={edited?.status === "queued" || edited?.status === "rendering"}>
              ✨ Edit & subtitle
            </Button>
            {raw?.status === "done" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setSrc({ url: `/api/renders/${raw.id}/file`, vertical: false, label: "Unedited" })}>
                  Watch unedited
                </Button>
                <a href={`/api/renders/${raw.id}/file?download=1`} className="inline-flex h-8 items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20">
                  Save unedited
                </a>
              </>
            )}
            {edited?.status === "done" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setSrc({ url: `/api/renders/${edited.id}/file`, vertical: true, label: "Edited" })}>
                  Watch edited
                </Button>
                <a href={`/api/renders/${edited.id}/file?download=1`} className="inline-flex h-8 items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20">
                  Save edited
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

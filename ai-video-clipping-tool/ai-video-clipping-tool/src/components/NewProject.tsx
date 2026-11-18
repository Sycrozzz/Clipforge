"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx, inputCls } from "./ui";

const CHUNK = 8 * 1024 * 1024;

function fmtSize(n: number) {
  return n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(0)} MB`;
}

export default function NewProject() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [showPath, setShowPath] = useState(false);
  const [pathValue, setPathValue] = useState("");

  async function upload(file: File) {
    setError("");
    setBusy(true);
    setPct(0);
    setLabel(`${file.name} · ${fmtSize(file.size)}`);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      const { project, error: e } = await res.json();
      if (!res.ok) throw new Error(e || "Could not create project");
      for (let offset = 0; offset < file.size; offset += CHUNK) {
        const slice = file.slice(offset, Math.min(file.size, offset + CHUNK));
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          try {
            const r = await fetch(`/api/projects/${project.id}/upload?offset=${offset}`, { method: "PUT", body: slice });
            ok = r.ok;
          } catch {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        if (!ok) throw new Error("Upload failed. Is the app still running?");
        setPct(Math.min(100, ((offset + slice.size) / file.size) * 100));
      }
      setLabel("Checking video…");
      const fin = await fetch(`/api/projects/${project.id}/finalize`, { method: "POST" });
      const j = await fin.json();
      if (!fin.ok) throw new Error(j.error || "Could not read this video");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function importPath() {
    setError("");
    setBusy(true);
    setLabel("Reading video…");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathValue }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not import");
      router.push(`/projects/${j.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void upload(f);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={cx(
          "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition",
          drag ? "border-violet-400 bg-violet-500/10" : "border-white/15 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.04]",
          busy && "cursor-default",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mkv,.mov,.mp4,.avi,.webm,.m4v"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {busy ? (
          <div className="mx-auto max-w-md">
            <p className="mb-3 truncate text-sm font-semibold text-zinc-200">{label}</p>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="shimmer h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-zinc-500">{pct < 100 ? `Importing… ${pct.toFixed(0)}%` : "Almost there…"}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 text-2xl">🎬</div>
            <h2 className="text-lg font-bold">Drop a long video here</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
              Podcasts, streams, interviews, lectures. 1–2 hours is fine. The file stays on your computer.
            </p>
            <Button variant="primary" className="mt-5" onClick={(e) => (e.stopPropagation(), inputRef.current?.click())}>
              Choose video file
            </Button>
          </>
        )}
      </div>

      {!busy && (
        <div className="mt-3 text-center">
          <button className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline" onClick={() => setShowPath((s) => !s)}>
            {showPath ? "Hide" : "Huge file? Use it in place by typing its path instead of copying it"}
          </button>
          {showPath && (
            <div className="mx-auto mt-3 flex max-w-xl gap-2">
              <input
                className={inputCls}
                placeholder={"C:\\Videos\\podcast-ep42.mp4  or  /Users/me/Movies/podcast.mp4"}
                value={pathValue}
                onChange={(e) => setPathValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && pathValue && void importPath()}
              />
              <Button onClick={importPath} disabled={!pathValue.trim()}>
                Import
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}

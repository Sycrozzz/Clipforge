"use client";

import { useState } from "react";
import { DEFAULT_ANALYSIS_PREFS, FOCUS_OPTIONS, type AnalysisPrefs, type ProjectDTO, fmtTime } from "@/lib/types";
import { Button, Card, Chip, Field, Range, Spinner, inputCls } from "./ui";

const LANGS = [
  ["", "Auto-detect"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
];

export default function AnalysisForm({ project, onStarted }: { project: ProjectDTO; onStarted: () => void }) {
  const [prefs, setPrefs] = useState<AnalysisPrefs>(project.analysisPrefs ?? DEFAULT_ANALYSIS_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof AnalysisPrefs>(k: K, v: AnalysisPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/projects/${project.id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not start");
      setBusy(false);
      return;
    }
    onStarted();
    setBusy(false);
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">What kind of clips do you want?</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Tell the AI what to look for in this {fmtTime(project.durationSec)} video. You can always run it again with different
          wishes{project.hasTranscript ? " (the transcript is saved, so re-runs are quick)" : ""}.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Look for</p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((f) => (
            <Chip
              key={f.id}
              active={prefs.focus.includes(f.id)}
              onClick={() => set("focus", prefs.focus.includes(f.id) ? prefs.focus.filter((x) => x !== f.id) : [...prefs.focus, f.id])}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Range label="Shortest clip" value={prefs.minLen} min={10} max={120} step={5} unit="s" onChange={(v) => set("minLen", Math.min(v, prefs.maxLen - 5))} />
        <Range label="Longest clip" value={prefs.maxLen} min={20} max={180} step={5} unit="s" onChange={(v) => set("maxLen", Math.max(v, prefs.minLen + 5))} />
        <Range label="Max number of clips" value={prefs.count} min={3} max={30} onChange={(v) => set("count", v)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Anything else?" hint="e.g. “Prefer moments where the guest tells a personal story. Skip sponsor reads.”">
          <textarea className={inputCls + " min-h-[84px] resize-y"} value={prefs.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label="Spoken language">
          <select className={inputCls} value={prefs.language} onChange={(e) => set("language", e.target.value)}>
            {LANGS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {(error || project.error) && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error || project.error}</p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">
          Takes roughly {Math.max(2, Math.round(project.durationSec / 60 / 8))}–{Math.max(4, Math.round(project.durationSec / 60 / 4))} minutes for this video.
        </p>
        <Button variant="primary" size="lg" onClick={start} disabled={busy || prefs.focus.length === 0}>
          {busy && <Spinner />} Find my best clips
        </Button>
      </div>
    </Card>
  );
}

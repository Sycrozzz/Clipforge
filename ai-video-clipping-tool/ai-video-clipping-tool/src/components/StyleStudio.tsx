"use client";

import { useState, type ReactNode } from "react";
import {
  FONT_OPTIONS,
  STYLE_PRESETS,
  DEFAULT_EDIT_PREFS,
  mergePrefs,
  normalizeEditPrefs,
  type ClipDTO,
  type EditPrefs,
} from "@/lib/types";
import { Button, ColorField, Field, Range, Segmented, Spinner, Toggle, cx, inputCls } from "./ui";
import PhonePreview from "./PhonePreview";

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function StyleStudio({
  clips,
  initial,
  onClose,
  onRender,
}: {
  clips: ClipDTO[]; // the selected clips (live)
  initial: EditPrefs;
  onClose: () => void;
  onRender: (prefs: EditPrefs, hookTexts: Record<string, string>) => Promise<void>;
}) {
  const [prefs, setPrefs] = useState<EditPrefs>(initial);
  const [hooks, setHooks] = useState<Record<string, string>>(() => Object.fromEntries(clips.map((c) => [c.id, c.hook])));
  const [assist, setAssist] = useState(initial.notes);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistMsg, setAssistMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);

  const first = clips[0];
  const testRender = first?.renders.filter((r) => r.kind === "preview").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const upd = <K extends keyof EditPrefs>(k: K, patch: Partial<EditPrefs[K]> | EditPrefs[K]) =>
    setPrefs((p) => ({ ...p, [k]: typeof patch === "object" && patch !== null ? { ...(p[k] as object), ...patch } : patch }) as EditPrefs);

  function applyPreset(id: string) {
    const preset = STYLE_PRESETS.find((p) => p.id === id)!;
    setPresetId(id);
    setPrefs((p) => {
      const base = mergePrefs(structuredClone(DEFAULT_EDIT_PREFS), preset.prefs);
      // keep format & personal choices when switching look
      base.aspect = p.aspect;
      base.reframe = p.reframe;
      base.focusX = p.focusX;
      base.quality = p.quality;
      base.handle = p.handle;
      base.audio = p.audio;
      return normalizeEditPrefs(base);
    });
  }

  async function runAssist() {
    setAssistBusy(true);
    setAssistMsg(null);
    try {
      const res = await fetch("/api/style-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: assist, prefs }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPrefs(j.prefs);
      setAssistMsg({ ok: true, text: j.summary });
    } catch (e) {
      setAssistMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    }
    setAssistBusy(false);
  }

  async function runTest() {
    if (!first) return;
    setTestBusy(true);
    await fetch("/api/clips/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipIds: [first.id], kind: "preview", prefs, hookTexts: hooks, previewSeconds: 8 }),
    });
    setTestBusy(false);
  }

  const testing = testRender && (testRender.status === "queued" || testRender.status === "rendering");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-full max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e15] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <div>
            <h2 className="text-lg font-bold">Your editing style</h2>
            <p className="text-xs text-zinc-500">
              Set it up once for {clips.length} clip{clips.length === 1 ? "" : "s"}. Nothing is edited until you press Render.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            ✕ Close
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[380px_1fr]">
          {/* LEFT: preview */}
          <div className="flex min-h-0 flex-col items-center gap-4 overflow-y-auto border-b border-white/[0.07] bg-black/30 p-5 lg:border-b-0 lg:border-r">
            <PhonePreview prefs={prefs} hook={hooks[first?.id ?? ""] ?? ""} />
            {first && (
              <div className="w-full space-y-2">
                <Button className="w-full" onClick={runTest} disabled={testBusy || !!testing}>
                  {(testBusy || testing) && <Spinner />} Test render (8s of “{first.title.slice(0, 22)}…”)
                </Button>
                {testRender?.status === "error" && <p className="text-xs text-red-300">{testRender.error}</p>}
                {testing && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="shimmer h-full" style={{ width: `${Math.max(6, testRender.progress)}%` }} />
                  </div>
                )}
                {testRender?.status === "done" && (
                  <video key={testRender.id} src={`/api/renders/${testRender.id}/file`} controls autoPlay loop muted className="mx-auto max-h-[420px] w-full rounded-xl bg-black" />
                )}
              </div>
            )}
          </div>

          {/* RIGHT: controls */}
          <div className="min-h-0 space-y-4 overflow-y-auto p-5">
            <Section title="Start from a look">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={cx(
                      "rounded-xl border p-3 text-left transition",
                      presetId === p.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">{p.description}</div>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
                <Field label="Or just tell the AI what you want" hint="e.g. “big pink captions in the middle, no zoom, add my handle @mychannel bottom right”">
                  <div className="flex gap-2">
                    <textarea className={inputCls + " min-h-[64px] resize-y"} value={assist} onChange={(e) => setAssist(e.target.value)} />
                    <Button variant="primary" className="h-auto self-stretch" onClick={runAssist} disabled={assistBusy || !assist.trim()}>
                      {assistBusy ? <Spinner /> : "Apply"}
                    </Button>
                  </div>
                </Field>
                {assistMsg && <p className={cx("mt-2 text-xs", assistMsg.ok ? "text-emerald-300" : "text-red-300")}>{assistMsg.text}</p>}
              </div>
            </Section>

            <Section title="Format">
              <Segmented
                value={prefs.aspect}
                onChange={(v) => upd("aspect", v)}
                options={[
                  { id: "9:16", label: "9:16 Shorts/Reels" },
                  { id: "4:5", label: "4:5 Feed" },
                  { id: "1:1", label: "1:1" },
                  { id: "16:9", label: "16:9" },
                ]}
              />
              <Field label="Framing">
                <Segmented
                  value={prefs.reframe}
                  onChange={(v) => upd("reframe", v)}
                  options={[
                    { id: "blur", label: "Full video on blurred background" },
                    { id: "crop", label: "Fill frame (crop sides)" },
                  ]}
                />
              </Field>
              {prefs.reframe === "crop" && <Range label="Crop focus (left ↔ right)" value={prefs.focusX} min={0} max={100} unit="%" onChange={(v) => upd("focusX", v)} />}
              <Field label="Quality">
                <Segmented
                  value={prefs.quality}
                  onChange={(v) => upd("quality", v)}
                  options={[
                    { id: "draft", label: "Fast 720p" },
                    { id: "standard", label: "Standard 1080p" },
                    { id: "high", label: "High (slower)" },
                  ]}
                />
              </Field>
            </Section>

            <Section title="Subtitles" right={<div className="w-28"><Toggle label="" checked={prefs.captions.enabled} onChange={(v) => upd("captions", { enabled: v })} /></div>}>
              {prefs.captions.enabled && (
                <>
                  <Field label="Font">
                    <select className={inputCls} value={prefs.captions.font} onChange={(e) => upd("captions", { font: e.target.value })}>
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Range label="Size" value={prefs.captions.size} min={50} max={200} unit="%" onChange={(v) => upd("captions", { size: v })} />
                    <Range label="Words on screen" value={prefs.captions.wordsPerLine} min={1} max={8} onChange={(v) => upd("captions", { wordsPerLine: v })} />
                    <Range label="Vertical position" value={prefs.captions.positionY} min={10} max={92} unit="%" onChange={(v) => upd("captions", { positionY: v })} />
                    <Range label="Outline" value={prefs.captions.outlineWidth} min={0} max={14} onChange={(v) => upd("captions", { outlineWidth: v })} />
                  </div>
                  <Field label="Spoken-word highlight">
                    <Segmented
                      value={prefs.captions.highlightMode}
                      onChange={(v) => upd("captions", { highlightMode: v })}
                      options={[
                        { id: "color", label: "Colour" },
                        { id: "box", label: "Marker box" },
                        { id: "scale", label: "Grow" },
                        { id: "none", label: "None" },
                      ]}
                    />
                  </Field>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <ColorField label="Text" value={prefs.captions.textColor} onChange={(v) => upd("captions", { textColor: v })} />
                    <ColorField label="Highlight" value={prefs.captions.highlightColor} onChange={(v) => upd("captions", { highlightColor: v })} />
                    <ColorField label="Outline" value={prefs.captions.outlineColor} onChange={(v) => upd("captions", { outlineColor: v })} />
                  </div>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <Toggle label="UPPERCASE" checked={prefs.captions.uppercase} onChange={(v) => upd("captions", { uppercase: v })} />
                    <Toggle label="Pop-in animation" checked={prefs.captions.popIn} onChange={(v) => upd("captions", { popIn: v })} />
                  </div>
                </>
              )}
            </Section>

            <Section title="Hook headline (first seconds)" right={<div className="w-28"><Toggle label="" checked={prefs.hook.enabled} onChange={(v) => upd("hook", { enabled: v })} /></div>}>
              {prefs.hook.enabled && (
                <>
                  <p className="text-xs text-zinc-500">AI-written attention grabber shown at the start. Edit the text for each clip:</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {clips.map((c) => (
                      <input
                        key={c.id}
                        className={inputCls}
                        value={hooks[c.id] ?? ""}
                        placeholder="Hook text"
                        onChange={(e) => setHooks((h) => ({ ...h, [c.id]: e.target.value }))}
                      />
                    ))}
                  </div>
                  <Segmented
                    value={prefs.hook.style}
                    onChange={(v) => upd("hook", { style: v })}
                    options={[
                      { id: "box", label: "Label box" },
                      { id: "text", label: "Outlined text" },
                    ]}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Range label="Show for" value={prefs.hook.duration} min={1.5} max={8} step={0.5} unit="s" onChange={(v) => upd("hook", { duration: v })} />
                    <Range label="Size" value={prefs.hook.size} min={60} max={180} unit="%" onChange={(v) => upd("hook", { size: v })} />
                    <Range label="Vertical position" value={prefs.hook.positionY} min={6} max={85} unit="%" onChange={(v) => upd("hook", { positionY: v })} />
                  </div>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    {prefs.hook.style === "box" && <ColorField label="Box" value={prefs.hook.boxColor} onChange={(v) => upd("hook", { boxColor: v })} />}
                    <ColorField label="Text" value={prefs.hook.textColor} onChange={(v) => upd("hook", { textColor: v })} />
                  </div>
                </>
              )}
            </Section>

            <Section title="Attention boosters">
              <Field label="Zoom">
                <Segmented
                  value={prefs.zoom.mode}
                  onChange={(v) => upd("zoom", { mode: v })}
                  options={[
                    { id: "none", label: "Off" },
                    { id: "slow", label: "Slow push-in" },
                    { id: "punch", label: "Punch-in on sentences" },
                  ]}
                />
              </Field>
              {prefs.zoom.mode !== "none" && <Range label="Zoom strength" value={prefs.zoom.intensity} min={3} max={25} unit="%" onChange={(v) => upd("zoom", { intensity: v })} />}
              <Toggle label="Progress bar (keeps viewers watching)" checked={prefs.progressBar.enabled} onChange={(v) => upd("progressBar", { enabled: v })} />
              {prefs.progressBar.enabled && (
                <div className="grid items-center gap-x-8 gap-y-2 sm:grid-cols-2">
                  <ColorField label="Bar colour" value={prefs.progressBar.color} onChange={(v) => upd("progressBar", { color: v })} />
                  <Segmented
                    value={prefs.progressBar.position}
                    onChange={(v) => upd("progressBar", { position: v })}
                    options={[
                      { id: "top", label: "Top" },
                      { id: "bottom", label: "Bottom" },
                    ]}
                  />
                </div>
              )}
              <Toggle label="Channel handle watermark" checked={prefs.handle.enabled} onChange={(v) => upd("handle", { enabled: v })} />
              {prefs.handle.enabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputCls} value={prefs.handle.text} onChange={(e) => upd("handle", { text: e.target.value })} />
                  <Segmented
                    value={prefs.handle.corner}
                    onChange={(v) => upd("handle", { corner: v })}
                    options={[
                      { id: "tl", label: "↖" },
                      { id: "tr", label: "↗" },
                      { id: "bl", label: "↙" },
                      { id: "br", label: "↘" },
                    ]}
                  />
                </div>
              )}
            </Section>

            <Section title="Audio">
              <Toggle label="Loudness normalisation (consistent, platform-ready volume)" checked={prefs.audio.normalize} onChange={(v) => upd("audio", { normalize: v })} />
              <Toggle label="Fade out at the end" checked={prefs.audio.fadeOut} onChange={(v) => upd("audio", { fadeOut: v })} />
            </Section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-black/20 px-5 py-3.5">
          <p className="text-xs text-zinc-500">Your choices are remembered for next time.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onRender({ ...prefs, notes: assist }, hooks);
                setBusy(false);
              }}
            >
              {busy && <Spinner />} Render {clips.length} edited clip{clips.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

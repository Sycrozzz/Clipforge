"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Spinner, inputCls } from "./ui";

interface S {
  apiKeySet: boolean;
  apiKeyHint: string;
  baseUrl: string;
  transcribeModel: string;
  chatModel: string;
  dataDir: string;
}

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    note: "Most accurate subtitles. About $0.36 per hour of video for transcription, plus a few cents for analysis.",
    baseUrl: "https://api.openai.com/v1",
    transcribeModel: "whisper-1",
    chatModel: "gpt-4o-mini",
  },
  {
    id: "groq",
    name: "Groq",
    note: "Very fast and has a free tier. Great for trying things out.",
    baseUrl: "https://api.groq.com/openai/v1",
    transcribeModel: "whisper-large-v3-turbo",
    chatModel: "llama-3.3-70b-versatile",
  },
];

export default function SettingsForm() {
  const [s, setS] = useState<S | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [tm, setTm] = useState("");
  const [cm, setCm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const j: S = await (await fetch("/api/settings")).json();
    setS(j);
    setBaseUrl(j.baseUrl);
    setTm(j.transcribeModel);
    setCm(j.chatModel);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(test: boolean) {
    setBusy(true);
    setMsg(null);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, transcribeModel: tm, chatModel: cm }),
    });
    setApiKey("");
    await load();
    if (test) {
      const r = await (await fetch("/api/settings", { method: "POST" })).json();
      setMsg(r.ok ? { ok: true, text: "Connected. You're good to go." } : { ok: false, text: r.error });
    } else setMsg({ ok: true, text: "Saved." });
    setBusy(false);
  }

  if (!s) return <div className="mt-10 flex justify-center"><Spinner /></div>;

  return (
    <div className="mt-6 space-y-5">
      <Card>
        <h2 className="mb-3 font-semibold">Provider</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const active = baseUrl === p.baseUrl;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setBaseUrl(p.baseUrl);
                  setTm(p.transcribeModel);
                  setCm(p.chatModel);
                }}
                className={`rounded-xl border p-4 text-left transition ${active ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-xs leading-relaxed text-zinc-400">{p.note}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 space-y-4">
          <Field label="API key" hint={s.apiKeySet ? `A key is saved (${s.apiKeyHint}). Leave blank to keep it.` : "Paste the key from your provider's dashboard. It is stored only on this computer."}>
            <input className={inputCls} type="password" autoComplete="off" placeholder="sk-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </Field>
          <details className="rounded-xl border border-white/5 bg-black/20 p-3">
            <summary className="cursor-pointer text-sm text-zinc-400">Advanced (custom endpoint & models)</summary>
            <div className="mt-3 space-y-3">
              <Field label="Base URL" hint="Any OpenAI-compatible API, including local servers.">
                <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Transcription model">
                  <input className={inputCls} value={tm} onChange={(e) => setTm(e.target.value)} />
                </Field>
                <Field label="Analysis model">
                  <input className={inputCls} value={cm} onChange={(e) => setCm(e.target.value)} />
                </Field>
              </div>
            </div>
          </details>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => save(true)} disabled={busy}>
            {busy && <Spinner />} Save & test connection
          </Button>
          {s.apiKeySet && (
            <Button
              variant="ghost"
              onClick={async () => {
                await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearKey: true }) });
                await load();
              }}
            >
              Remove key
            </Button>
          )}
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</span>}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Where your files live</h2>
        <p className="mt-1 break-all font-mono text-xs text-zinc-400">{s.dataDir}</p>
        <p className="mt-2 text-xs text-zinc-500">Finished clips are stored in this folder, under projects/&lt;id&gt;/clips. You can also open it from any project.</p>
      </Card>
    </div>
  );
}

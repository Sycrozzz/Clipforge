import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { getAiConfig } from "@/lib/settings";
import { fmtTime } from "@/lib/types";
import NewProject from "@/components/NewProject";
import DeleteProject from "@/components/DeleteProject";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  uploading: { label: "Importing", cls: "bg-zinc-500/20 text-zinc-300" },
  uploaded: { label: "Ready to analyse", cls: "bg-sky-500/15 text-sky-300" },
  processing: { label: "Analysing", cls: "bg-amber-500/15 text-amber-300" },
  ready: { label: "Clips ready", cls: "bg-emerald-500/15 text-emerald-300" },
  error: { label: "Needs attention", cls: "bg-red-500/15 text-red-300" },
};

export default async function HomePage() {
  const db = await getDb();
  const [rows, cfg] = await Promise.all([db.select().from(projects).orderBy(desc(projects.createdAt)), getAiConfig()]);
  const list = rows.filter((p) => p.status !== "uploading");

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="bg-gradient-to-r from-white via-violet-200 to-pink-200 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Turn hours into viral minutes.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Drop in a long video. ClipForge finds the most engaging, emotional moments, then cuts them, captions them and adds the
          attention hooks, in the style <em>you</em> choose.
        </p>
      </section>

      {!cfg.apiKey && (
        <Link
          href="/settings"
          className="flex items-center justify-between gap-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100 transition hover:bg-amber-400/15"
        >
          <span>
            <strong>One quick step:</strong> add your AI API key so ClipForge can transcribe speech and find the best moments.
          </span>
          <span className="shrink-0 font-semibold">Open Settings →</span>
        </Link>
      )}

      <NewProject />

      {list.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Your projects</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => {
              const s = STATUS[p.status] ?? STATUS.uploaded;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#12121a]/90 p-4 transition hover:border-violet-400/40 hover:bg-[#161622]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-100">{p.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {fmtTime(p.durationSec)} · {p.width}×{p.height} · {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                    <DeleteProject id={p.id} name={p.name} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

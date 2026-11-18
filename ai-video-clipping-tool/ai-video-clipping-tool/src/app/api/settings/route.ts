import { getAiConfig, getSavedEditPrefs, setSetting, AI_DEFAULTS } from "@/lib/settings";
import { DATA_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getAiConfig();
  return Response.json({
    apiKeySet: !!cfg.apiKey,
    apiKeyHint: cfg.apiKey ? `••••${cfg.apiKey.slice(-4)}` : "",
    baseUrl: cfg.baseUrl,
    transcribeModel: cfg.transcribeModel,
    chatModel: cfg.chatModel,
    defaults: AI_DEFAULTS,
    editPrefs: await getSavedEditPrefs(),
    dataDir: DATA_DIR,
  });
}

export async function PUT(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.apiKey === "string" && b.apiKey.trim()) await setSetting("apiKey", b.apiKey.trim());
  if (b.clearKey === true) await setSetting("apiKey", "");
  for (const k of ["baseUrl", "transcribeModel", "chatModel"] as const) {
    if (typeof b[k] === "string") await setSetting(k, (b[k] as string).trim());
  }
  return Response.json({ ok: true });
}

// Test the connection with the saved credentials.
export async function POST() {
  const cfg = await getAiConfig();
  if (!cfg.apiKey) return Response.json({ ok: false, error: "No API key saved yet." });
  try {
    const res = await fetch(`${cfg.baseUrl}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    if (!res.ok) return Response.json({ ok: false, error: `Provider answered ${res.status}: ${(await res.text()).slice(0, 200)}` });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Could not reach the provider." });
  }
}

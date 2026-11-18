import { chatJson } from "@/lib/ai";
import { FONT_OPTIONS, mergePrefs, normalizeEditPrefs } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM = `You translate a creator's plain-language editing wishes into settings for a short-form video editor.
You receive the CURRENT settings (JSON) and a REQUEST. Return JSON: {"prefs": <only the keys that must change, same nested structure>, "summary": "<one short friendly sentence describing what you changed>"}.
Allowed values:
- aspect: "9:16" | "1:1" | "4:5" | "16:9"; reframe: "crop" | "blur" (blur = whole video centred over a blurred copy); focusX: 0-100; quality: "draft" | "standard" | "high"
- captions: enabled(bool), font (one of: ${FONT_OPTIONS.map((f) => f.id).join(", ")}), size 50-200 (percent), uppercase(bool), wordsPerLine 1-8, textColor "#RRGGBB", highlightColor "#RRGGBB", highlightMode "color"|"box"|"scale"|"none", outlineColor, outlineWidth 0-14, shadow 0-10, popIn(bool), positionY 5-95 (percent from top; 66 = lower third, 50 = centre, 85 = very bottom)
- hook: enabled, duration 1-10 (seconds), style "box"|"text", boxColor, textColor, positionY 5-90, size 50-200
- progressBar: enabled, color, position "top"|"bottom", thickness 2-30
- zoom: mode "none"|"slow"|"punch" (punch = alternating punch-in jump-cut zoom per sentence), intensity 3-25
- handle: enabled, text, corner "tl"|"tr"|"bl"|"br"
- audio: normalize(bool), fadeOut(bool)
Only change what the request implies. Never invent keys.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { request?: string; prefs?: unknown };
  const request = String(body.request ?? "").trim();
  if (!request) return Response.json({ error: "Describe the style you want." }, { status: 400 });
  const current = normalizeEditPrefs(body.prefs);
  try {
    const raw = (await chatJson(SYSTEM, `CURRENT:\n${JSON.stringify({ ...current, notes: undefined })}\n\nREQUEST:\n${request}`, 0.2)) as {
      prefs?: unknown;
      summary?: string;
    };
    const next = normalizeEditPrefs(mergePrefs(current, raw.prefs ?? {}));
    next.notes = request;
    return Response.json({ prefs: next, summary: raw.summary ?? "Style updated." });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not interpret that request." }, { status: 500 });
  }
}

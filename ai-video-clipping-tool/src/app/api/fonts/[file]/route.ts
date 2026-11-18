import path from "node:path";
import { FONTS_DIR } from "@/lib/paths";
import { serveFile } from "@/lib/serve";
import { FONT_OPTIONS } from "@/lib/types";

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!FONT_OPTIONS.some((f) => f.file === file)) return new Response("Not found", { status: 404 });
  const res = serveFile(req, path.join(FONTS_DIR, file));
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}

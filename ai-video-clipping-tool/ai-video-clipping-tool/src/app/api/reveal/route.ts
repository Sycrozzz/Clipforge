import { spawn } from "node:child_process";
import fs from "node:fs";
import { subDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

// Opens the folder that contains the exported clips in Explorer / Finder.
export async function POST(req: Request) {
  const { projectId } = (await req.json().catch(() => ({}))) as { projectId?: string };
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return Response.json({ error: "Bad id" }, { status: 400 });
  const dir = subDir(projectId, "clips");
  const cmd = process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
  try {
    const p = spawn(cmd, [dir], { detached: true, stdio: "ignore" });
    p.on("error", () => undefined);
    p.unref();
  } catch {
    /* ignore */
  }
  return Response.json({ ok: fs.existsSync(dir), path: dir });
}

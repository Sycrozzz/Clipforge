import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.CLIPFORGE_DATA_DIR || path.join(process.cwd(), "data");
export const ASSETS_DIR = process.env.CLIPFORGE_ASSETS_DIR || path.join(process.cwd(), "assets");
export const FONTS_DIR = path.join(ASSETS_DIR, "fonts");

export function projectDir(id: string): string {
  const dir = path.join(DATA_DIR, "projects", id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function subDir(id: string, name: string): string {
  const dir = path.join(projectDir(id), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function safeName(s: string): string {
  return (
    s
      .replace(/[^\p{L}\p{N}\-_. ]+/gu, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "clip"
  );
}

// Stages a self-contained desktop app and packages it with electron-builder.
// Usage (from the project root, after `npm ci`):
//   CLIPFORGE_DESKTOP_BUILD=1 node desktop/build.mjs
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const stage = path.join(root, "build-desktop");
const run = (cmd, cwd = root) => execSync(cmd, { stdio: "inherit", cwd, env: { ...process.env, CLIPFORGE_DESKTOP_BUILD: "1" } });

rmSync(stage, { recursive: true, force: true });
run("npx next build");

const standalone = path.join(root, ".next", "standalone");
const server = path.join(stage, "server");
mkdirSync(server, { recursive: true });
cpSync(standalone, server, { recursive: true });
mkdirSync(path.join(server, ".next"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(server, ".next", "static"), { recursive: true });
cpSync(path.join(root, "assets"), path.join(server, "assets"), { recursive: true });
if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(server, "public"), { recursive: true });
// Packages with native binaries / wasm must be copied in full.
for (const pkg of ["ffmpeg-static", "ffprobe-static", "@electric-sql/pglite"]) {
  cpSync(path.join(root, "node_modules", pkg), path.join(server, "node_modules", pkg), { recursive: true, dereference: true });
}

cpSync(path.join(root, "desktop", "main.js"), path.join(stage, "main.js"));
writeFileSync(
  path.join(stage, "package.json"),
  JSON.stringify(
    {
      name: "clipforge",
      productName: "ClipForge",
      version: "1.0.0",
      description: "AI clipping studio",
      author: "ClipForge",
      main: "main.js",
      build: {
        appId: "app.clipforge.desktop",
        productName: "ClipForge",
        directories: { output: "../dist-desktop" },
        files: ["main.js", "package.json"],
        extraResources: [{ from: "server", to: "server" }],
        win: { target: ["nsis", "portable"] },
        nsis: { oneClick: true, perMachine: false },
        mac: { target: ["dmg"], category: "public.app-category.video" },
        linux: { target: ["AppImage"], category: "AudioVideo" },
      },
    },
    null,
    2,
  ),
);

run("npm install --no-save --no-audit --no-fund electron@33 electron-builder@25", stage);
run("npx electron-builder", stage);
console.log("\nDone. Installers are in ./dist-desktop");

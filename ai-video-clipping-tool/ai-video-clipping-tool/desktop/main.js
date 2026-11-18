// ClipForge desktop shell (Electron). Starts the bundled Next.js server locally and shows it in a window.
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const http = require("node:http");

let child = null;
let win = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

function waitForServer(port, tries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry(n);
      });
      req.on("error", () => retry(n));
      req.on("timeout", () => req.destroy());
    };
    const retry = (n) => (n <= 0 ? reject(new Error("The ClipForge engine did not start.")) : setTimeout(() => attempt(n - 1), 500));
    attempt(tries);
  });
}

async function boot() {
  const port = await freePort();
  const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "build-desktop");
  const serverDir = path.join(resources, "server");
  const dataDir = path.join(app.getPath("documents"), "ClipForge");

  child = spawn(process.execPath, [path.join(serverDir, "server.js")], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: "", // empty -> embedded database inside the data folder
      CLIPFORGE_DATA_DIR: dataDir,
      CLIPFORGE_ASSETS_DIR: path.join(serverDir, "assets"),
    },
    stdio: "ignore",
  });
  child.on("exit", (code) => {
    if (!app.isQuitting && code) dialog.showErrorBox("ClipForge stopped", `The engine exited unexpectedly (code ${code}).`);
  });

  await waitForServer(port);
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a0f",
    title: "ClipForge",
    autoHideMenuBar: true,
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  await win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(() =>
  boot().catch((e) => {
    dialog.showErrorBox("ClipForge could not start", String(e && e.message ? e.message : e));
    app.quit();
  }),
);

app.on("before-quit", () => {
  app.isQuitting = true;
  if (child) child.kill();
});
app.on("window-all-closed", () => app.quit());

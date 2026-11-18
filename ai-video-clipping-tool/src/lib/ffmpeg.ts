import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

function resolveBin(p: string | null | undefined, fallback: string): string {
  return process.env[fallback === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"] || p || fallback;
}

export const FFMPEG = resolveBin(ffmpegPath, "ffmpeg");
export const FFPROBE = resolveBin(ffprobe.path, "ffprobe");

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export function probe(file: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${err.slice(-300)}`));
      try {
        const j = JSON.parse(out);
        const v = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "video");
        const a = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "audio");
        if (!v) return reject(new Error("No video stream found in this file."));
        resolve({
          durationSec: Number(j.format?.duration ?? v.duration ?? 0),
          width: Number(v.width ?? 0),
          height: Number(v.height ?? 0),
          hasAudio: !!a,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export interface RunOpts {
  cwd?: string;
  /** Called with the output timestamp (seconds) as ffmpeg progresses. */
  onProgress?: (outSec: number) => void;
  signal?: AbortSignal;
}

export function runFfmpeg(args: string[], opts: RunOpts = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const full = ["-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", ...args];
    const p = spawn(FFMPEG, full, { cwd: opts.cwd });
    let err = "";
    let buf = "";
    p.stdout.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const m = line.match(/^out_time_(?:us|ms)=(\d+)/);
        if (m && opts.onProgress) opts.onProgress(Number(m[1]) / 1_000_000);
      }
    });
    p.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 6000) err = err.slice(-6000);
    });
    const onAbort = () => p.kill("SIGKILL");
    opts.signal?.addEventListener("abort", onAbort);
    p.on("error", (e) => reject(e));
    p.on("close", (code) => {
      opts.signal?.removeEventListener("abort", onAbort);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${err.trim().split("\n").slice(-6).join(" | ")}`));
    });
  });
}

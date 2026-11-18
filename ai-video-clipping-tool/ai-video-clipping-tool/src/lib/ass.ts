import { FONT_OPTIONS, type Aspect, type EditPrefs } from "./types";
import type { TWord } from "./transcript";

export function outputSize(aspect: Aspect, quality: EditPrefs["quality"]): { w: number; h: number } {
  const s = quality === "draft" ? 720 / 1080 : 1;
  const dims: Record<Aspect, [number, number]> = {
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    "16:9": [1920, 1080],
  };
  const [w, h] = dims[aspect];
  const even = (n: number) => Math.round(n / 2) * 2;
  return { w: even(w * s), h: even(h * s) };
}

function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s - h * 3600 - m * 60;
  const cs = Math.min(99, Math.round((r - Math.floor(r)) * 100));
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(r)).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** "#RRGGBB" -> "BBGGRR" (ASS byte order) */
function bgr(hex: string): string {
  const h = hex.replace("#", "");
  return (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
}
const styleColor = (hex: string, alpha = "00") => `&H${alpha}${bgr(hex)}`;
const tagColor = (hex: string) => `&H${bgr(hex)}&`;

function esc(s: string): string {
  return s.replace(/\\/g, "").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, " ");
}

function wrapLines(text: string, maxChars: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.join("\\N");
}

interface Chunk {
  words: TWord[];
}

function chunkWords(words: TWord[], perLine: number): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: TWord[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const breakHere =
      cur.length >= perLine || (prev && (w.s - prev.e > 0.8 || /[.!?…]$/.test(prev.w) || (cur.length >= 2 && /[,;:]$/.test(prev.w) && perLine > 2)));
    if (breakHere && cur.length) {
      chunks.push({ words: cur });
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) chunks.push({ words: cur });
  return chunks;
}

export interface AssInput {
  /** words in clip-relative seconds */
  words: TWord[];
  duration: number;
  hookText: string;
  prefs: EditPrefs;
  width: number;
  height: number;
}

export function buildAss({ words, duration, hookText, prefs, width: W, height: H }: AssInput): string {
  const k = W / 1080; // scale everything relative to a 1080px wide canvas
  const font = FONT_OPTIONS.find((f) => f.id === prefs.captions.font) ?? FONT_OPTIONS[0];
  const c = prefs.captions;
  const capPx = Math.round(Math.min(W, 1080) * 0.08 * (c.size / 100) * (W > 1080 ? 1 : 1));
  const outline = +(c.outlineWidth * k).toFixed(1);
  const shadow = +(c.shadow * k).toFixed(1);
  const bold = font.bold ? -1 : 0;

  const hk = prefs.hook;
  const hookPx = Math.round(Math.min(W, 1080) * 0.062 * (hk.size / 100));
  const hookBox = hk.style === "box";

  const lines: string[] = [];
  lines.push(
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: Cap,${font.id},${capPx},${styleColor(c.textColor)},${styleColor(c.textColor)},${styleColor(c.outlineColor)},&H80000000,${bold},0,0,0,100,100,0,0,1,${outline},${shadow},5,${Math.round(70 * k)},${Math.round(70 * k)},0,1`,
    `Style: Hook,${font.id},${hookPx},${styleColor(hk.textColor)},${styleColor(hk.textColor)},${hookBox ? styleColor(hk.boxColor) : "&H00000000"},&H64000000,${bold},0,0,0,100,100,0,0,${hookBox ? 3 : 1},${hookBox ? Math.round(18 * k) : Math.round(8 * k)},${hookBox ? 0 : Math.round(3 * k)},5,${Math.round(90 * k)},${Math.round(90 * k)},0,1`,
    `Style: Handle,Poppins,${Math.round(36 * k)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,${Math.round(3 * k)},0,5,20,20,0,1`,
    `Style: Bar,Poppins,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  );

  const dlg = (layer: number, s: number, e: number, style: string, text: string) =>
    lines.push(`Dialogue: ${layer},${assTime(s)},${assTime(e)},${style},,0,0,0,,${text}`);

  // Progress bar
  if (prefs.progressBar.enabled && duration > 0) {
    const t = Math.round(prefs.progressBar.thickness * k);
    const y = prefs.progressBar.position === "top" ? 0 : H - t;
    dlg(
      0,
      0,
      duration,
      "Bar",
      `{\\an7\\pos(0,${y})\\bord0\\shad0\\1c${tagColor(prefs.progressBar.color)}\\p1\\fscx0.1\\t(0,${Math.round(duration * 1000)},\\fscx100)}m 0 0 l ${W} 0 ${W} ${t} 0 ${t}{\\p0}`,
    );
  }

  // Captions
  if (c.enabled && words.length) {
    const y = Math.round((c.positionY / 100) * H);
    const pos = `\\an5\\pos(${Math.round(W / 2)},${y})`;
    const chunks = chunkWords(words, c.wordsPerLine);
    const fmt = (w: string) => esc(c.uppercase ? w.toUpperCase() : w);
    const base = tagColor(c.textColor);
    const hl = tagColor(c.highlightColor);
    const ol = tagColor(c.outlineColor);
    chunks.forEach((chunk, ci) => {
      const ws = chunk.words;
      const nextStart = chunks[ci + 1]?.words[0].s ?? Infinity;
      ws.forEach((w, i) => {
        const start = i === 0 ? w.s : ws[i].s;
        let end = i < ws.length - 1 ? ws[i + 1].s : Math.min(w.e + 0.3, nextStart);
        if (i === ws.length - 1) end = Math.max(end, w.e);
        if (end - start < 0.05) end = start + 0.05;
        const parts = ws.map((x, j) => {
          const t = fmt(x.w);
          if (j !== i || c.highlightMode === "none") return t;
          switch (c.highlightMode) {
            case "box":
              return `{\\1c${hl}\\3c${hl}\\bord${(outline + 8 * k).toFixed(1)}}${t}{\\1c${base}\\3c${ol}\\bord${outline}}`;
            case "scale":
              return `{\\1c${hl}\\fscx115\\fscy115}${t}{\\1c${base}\\fscx100\\fscy100}`;
            default:
              return `{\\1c${hl}}${t}{\\1c${base}}`;
          }
        });
        const pop = c.popIn && i === 0 && c.highlightMode !== "scale" ? "\\fscx88\\fscy88\\t(0,110,\\fscx100\\fscy100)" : "";
        dlg(1, start, end, "Cap", `{${pos}${pop}}${parts.join(" ")}`);
      });
    });
  }

  // Hook headline
  if (hk.enabled && hookText.trim()) {
    const text = hk.style === "box" || c.uppercase ? hookText.toUpperCase() : hookText;
    const maxChars = Math.max(10, Math.floor((W - 200 * k) / (hookPx * 0.62)));
    const wrapped = wrapLines(esc(text), maxChars);
    const y = Math.round((hk.positionY / 100) * H);
    const end = Math.min(hk.duration, duration);
    dlg(2, 0.15, end, "Hook", `{\\an5\\pos(${Math.round(W / 2)},${y})\\fad(180,260)\\fscx90\\fscy90\\t(0,220,\\fscx100\\fscy100)}${wrapped}`);
  }

  // Handle / watermark
  if (prefs.handle.enabled && prefs.handle.text.trim()) {
    const m = Math.round(44 * k);
    const top = Math.round(80 * k);
    const bottom = H - Math.round(150 * k);
    const map = {
      tl: `\\an7\\pos(${m},${top})`,
      tr: `\\an9\\pos(${W - m},${top})`,
      bl: `\\an1\\pos(${m},${bottom})`,
      br: `\\an3\\pos(${W - m},${bottom})`,
    } as const;
    dlg(0, 0, duration, "Handle", `{${map[prefs.handle.corner]}\\alpha&H4D&}${esc(prefs.handle.text)}`);
  }

  return lines.join("\n") + "\n";
}

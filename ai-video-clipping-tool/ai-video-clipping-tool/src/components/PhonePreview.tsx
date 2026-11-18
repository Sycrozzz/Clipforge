"use client";

import { useEffect, useState } from "react";
import { outputSize } from "@/lib/ass";
import { FONT_OPTIONS, type EditPrefs } from "@/lib/types";

const SAMPLE = "this is the part nobody tells you about".split(" ");

/** A CSS approximation of the final look so style changes are visible instantly. */
export default function PhonePreview({ prefs, hook }: { prefs: EditPrefs; hook: string }) {
  const { w: W, h: H } = outputSize(prefs.aspect, "standard");
  const width = prefs.aspect === "16:9" ? 340 : 232;
  const k = width / W;
  const height = H * k;
  const c = prefs.captions;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 520);
    return () => clearInterval(t);
  }, []);

  const perLine = Math.max(1, c.wordsPerLine);
  const chunkIndex = Math.floor(tick / perLine) % Math.ceil(SAMPLE.length / perLine);
  const chunk = SAMPLE.slice(chunkIndex * perLine, chunkIndex * perLine + perLine);
  const active = tick % perLine;

  const capPx = Math.min(W, 1080) * 0.08 * (c.size / 100) * k;
  const hookPx = Math.min(W, 1080) * 0.062 * (prefs.hook.size / 100) * k;
  const hookText = (hook || "The secret nobody tells you").trim();

  return (
    <div className="flex flex-col items-center">
      <style>{FONT_OPTIONS.map((f) => `@font-face{font-family:"${f.id}";src:url(/api/fonts/${f.file}) format("truetype");}`).join("")}
        {`@keyframes cfbar{from{width:0}to{width:100%}} @keyframes cfzoom{0%,45%{transform:scale(1)}50%,95%{transform:scale(${1 + prefs.zoom.intensity / 100})}100%{transform:scale(1)}} @keyframes cfslow{from{transform:scale(1)}to{transform:scale(${1 + prefs.zoom.intensity / 100})}}`}
      </style>
      <div className="relative overflow-hidden rounded-[22px] border-[5px] border-zinc-800 bg-black shadow-2xl shadow-black/60" style={{ width, height: height + 0 }}>
        {/* "video" layer */}
        <div
          className="absolute inset-0"
          style={{
            animation:
              prefs.zoom.mode === "punch" ? "cfzoom 4s steps(1) infinite" : prefs.zoom.mode === "slow" ? "cfslow 8s linear infinite alternate" : undefined,
          }}
        >
          {prefs.reframe === "blur" ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-fuchsia-900 to-rose-800 blur-md" />
              <div className="absolute left-0 right-0 top-1/2 grid -translate-y-1/2 place-items-center bg-gradient-to-br from-slate-700 to-slate-500 text-3xl" style={{ aspectRatio: "16/9" }}>
                🎙️
              </div>
            </>
          ) : (
            <div
              className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-700 via-slate-600 to-indigo-700 text-5xl"
              style={{ paddingLeft: `${(prefs.focusX - 50) * -0.6}%` }}
            >
              🎙️
            </div>
          )}
        </div>

        {prefs.progressBar.enabled && (
          <div
            className="absolute left-0 w-full"
            style={{ [prefs.progressBar.position]: 0, height: Math.max(2, prefs.progressBar.thickness * k) } as React.CSSProperties}
          >
            <div style={{ height: "100%", background: prefs.progressBar.color, animation: "cfbar 6s linear infinite" }} />
          </div>
        )}

        {prefs.hook.enabled && (
          <div className="absolute left-0 right-0 flex justify-center px-[8%] text-center" style={{ top: `${prefs.hook.positionY}%`, transform: "translateY(-50%)" }}>
            <span
              style={{
                fontFamily: `"${prefs.captions.font}"`,
                fontSize: hookPx,
                lineHeight: 1.2,
                color: prefs.hook.textColor,
                background: prefs.hook.style === "box" ? prefs.hook.boxColor : "transparent",
                padding: prefs.hook.style === "box" ? `${4 * k * 3}px ${18 * k}px` : 0,
                textTransform: c.uppercase || prefs.hook.style === "box" ? "uppercase" : "none",
                WebkitTextStroke: prefs.hook.style === "text" ? `${6 * k}px #000` : undefined,
                paintOrder: "stroke fill",
              }}
            >
              {hookText}
            </span>
          </div>
        )}

        {c.enabled && (
          <div className="absolute left-0 right-0 px-[6%] text-center" style={{ top: `${c.positionY}%`, transform: "translateY(-50%)" }}>
            <span
              style={{
                fontFamily: `"${c.font}"`,
                fontSize: capPx,
                lineHeight: 1.15,
                color: c.textColor,
                textTransform: c.uppercase ? "uppercase" : "none",
                WebkitTextStroke: `${c.outlineWidth * 2 * k}px ${c.outlineColor}`,
                paintOrder: "stroke fill",
                textShadow: c.shadow ? `0 ${c.shadow * k * 1.5}px ${c.shadow * k * 2}px rgba(0,0,0,.6)` : undefined,
              }}
            >
              {chunk.map((w, i) => {
                const on = i === active && c.highlightMode !== "none";
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginRight: i < chunk.length - 1 ? "0.28em" : 0,
                      color: on ? c.highlightColor : c.textColor,
                      background: on && c.highlightMode === "box" ? c.highlightColor : undefined,
                      borderRadius: 6 * k * 2,
                      padding: on && c.highlightMode === "box" ? `0 ${6 * k * 2}px` : undefined,
                      transform: on && c.highlightMode === "scale" ? "scale(1.15)" : undefined,
                      WebkitTextStroke: on && c.highlightMode === "box" ? "0" : undefined,
                    } as React.CSSProperties}
                  >
                    {w}
                  </span>
                );
              })}
            </span>
          </div>
        )}

        {prefs.handle.enabled && (
          <div
            className="absolute font-semibold text-white/70"
            style={{
              fontSize: 36 * k,
              [prefs.handle.corner[0] === "t" ? "top" : "bottom"]: (prefs.handle.corner[0] === "t" ? 80 : 150) * k,
              [prefs.handle.corner[1] === "l" ? "left" : "right"]: 44 * k,
            } as React.CSSProperties}
          >
            {prefs.handle.text}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Live approximation · use “Test render” for the exact result</p>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, Maximize2, Layers } from "lucide-react";
import { seeded } from "../../lib/mock-data";
import { cn } from "../../lib/utils";

export const MAP_W = 1000;
export const MAP_H = 700;
const CELL = 20;
const COLS = MAP_W / CELL + 1;
const ROWS = MAP_H / CELL + 1;

export type MapMode = "ortho" | "hypso" | "slope" | "mdt" | "mds" | "vari" | "exg" | "gli" | "none";

export function elevation(x: number, y: number, v = 1) {
  const g = (cx: number, cy: number, sx: number, sy: number, h: number) => h * Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  const o = (v % 3) * 60;
  return 0.18 + 0.25 * (1 - y / MAP_H) + g(330 + o, 260, 210, 160, 0.45) + g(720 - o, 470, 170, 200, 0.32) + g(820, 140, 120, 90, 0.18) - g(560, 640, 300, 60, 0.12);
}
const altitude = (e: number) => Math.round(712 + e * 140);

function useGrid(v: number) {
  return useMemo(() => {
    const z: number[][] = [];
    let min = 9, max = -9;
    for (let j = 0; j < ROWS; j++) {
      const row: number[] = [];
      for (let i = 0; i < COLS; i++) {
        const e = elevation(i * CELL, j * CELL, v);
        row.push(e);
        min = Math.min(min, e);
        max = Math.max(max, e);
      }
      z.push(row);
    }
    return { z, min, max };
  }, [v]);
}

function contourPaths(z: number[][], levels: number[]) {
  const at = (j: number, i: number) => z[j]?.[i] ?? 0;
  return levels.map((lv) => {
    let d = "";
    for (let j = 0; j < ROWS - 1; j++)
      for (let i = 0; i < COLS - 1; i++) {
        const a = at(j, i), b = at(j, i + 1), c = at(j + 1, i + 1), e = at(j + 1, i);
        const pts: [number, number][] = [];
        const edge = (p: number, q: number, x1: number, y1: number, x2: number, y2: number) => {
          if ((p < lv) !== (q < lv)) {
            const t = (lv - p) / (q - p);
            pts.push([(x1 + (x2 - x1) * t) * CELL, (y1 + (y2 - y1) * t) * CELL]);
          }
        };
        edge(a, b, i, j, i + 1, j);
        edge(b, c, i + 1, j, i + 1, j + 1);
        edge(e, c, i, j + 1, i + 1, j + 1);
        edge(a, e, i, j, i, j + 1);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          const p = pts[k]!, q = pts[k + 1]!;
          d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
        }
      }
    return { lv, d };
  });
}

const hypsoColor = (t: number) => {
  const stops = ["--hypso-1", "--hypso-2", "--hypso-3", "--hypso-4", "--hypso-5"];
  const f = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(f);
  return `color-mix(in oklab, var(${stops[i]}) ${Math.round((1 - (f - i)) * 100)}%, var(${stops[i + 1]}))`;
};

function Fields({ v, mode }: { v: number; mode: MapMode }) {
  const fields = useMemo(() => {
    const r = seeded(v * 7 + 3);
    const out: { pts: string; c: number; vig: number; rot: number }[] = [];
    const cols = 6, rows = 4;
    const jx = (i: number, j: number) => (i === 0 || i === cols ? 0 : (seeded(i * 31 + j * 17 + v)() - 0.5) * 70);
    const P = (i: number, j: number) => [(i * MAP_W) / cols + jx(i, j), (j * MAP_H) / rows + jx(j + 3, i)] as const;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        out.push({ pts: [a, b, c, d].map((p) => p.join(",")).join(" "), c: Math.floor(r() * 5), vig: r(), rot: r() > 0.5 ? 25 : -20 });
      }
    return out;
  }, [v]);
  const veg = mode === "vari" || mode === "exg" || mode === "gli";
  const pal = ["--terrain-1", "--terrain-2", "--terrain-3", "--terrain-4", "--terrain-5"];
  return (
    <g>
      {fields.map((f, k) => (
        <polygon key={k} points={f.pts} fill={veg ? hypsoColor(1 - (mode === "exg" ? f.vig * 0.8 + 0.1 : mode === "gli" ? f.vig * 0.6 + 0.2 : f.vig)) : `var(${pal[f.c]})`} stroke="var(--terrain-road)" strokeOpacity={0.5} strokeWidth={3} />
      ))}
      {!veg && fields.map((f, k) => <polygon key={`t${k}`} points={f.pts} fill="url(#rows)" opacity={0.35} />)}
    </g>
  );
}

export interface MapView { k: number; x: number; y: number }

export function AerialMap({
  mode = "ortho", variant = 1, contours = false, contourStep = 0.04, opacity = 1, children, overlay, className, onMapClick, onMapMove, showFooter = true, hillshade = false,
}: {
  mode?: MapMode; variant?: number; contours?: boolean; contourStep?: number; opacity?: number; children?: ReactNode; overlay?: ReactNode; className?: string;
  onMapClick?: (p: { x: number; y: number }) => void; onMapMove?: (p: { x: number; y: number }) => void; showFooter?: boolean; hillshade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView>({ k: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [cursor, setCursor] = useState({ x: 500, y: 350 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const { z, min, max } = useGrid(variant);
  const levels = useMemo(() => {
    const l: number[] = [];
    for (let t = Math.ceil(min / contourStep) * contourStep; t < max; t += contourStep) l.push(t);
    return l;
  }, [min, max, contourStep]);
  const paths = useMemo(() => (contours ? contourPaths(z, levels) : []), [contours, z, levels]);

  const toMap = (clientX: number, clientY: number) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const s = Math.max(MAP_W / r.width, MAP_H / r.height);
    const ox = (r.width * s - MAP_W) / 2, oy = (r.height * s - MAP_H) / 2;
    const px = (clientX - r.left) * s - ox, py = (clientY - r.top) * s - oy;
    const v = viewRef.current;
    return { x: (px - v.x) / v.k, y: (py - v.y) / v.k, px, py };
  };

  const zoomAt = (px: number, py: number, next: number) => {
    setView((v) => {
      const k = Math.min(8, Math.max(1, next));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const p = toMap(e.clientX, e.clientY);
      zoomAt(p.px, p.py, viewRef.current.k * Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const e = elevation(cursor.x, cursor.y, variant);
  const E = -49.12 + cursor.x * 0.00003, N = -17.79 - cursor.y * 0.00003;

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-[var(--sidebar)]", className)}>
      <div
        ref={ref}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          drag.current = { sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerMove={(ev) => {
          const p = toMap(ev.clientX, ev.clientY);
          setCursor({ x: p.x, y: p.y });
          onMapMove?.({ x: p.x, y: p.y });
          const d = drag.current;
          if (!d) return;
          const r = ref.current!.getBoundingClientRect();
          const s = Math.max(MAP_W / r.width, MAP_H / r.height);
          const dx = (ev.clientX - d.sx) * s, dy = (ev.clientY - d.sy) * s;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(ev) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved && onMapClick) {
            const p = toMap(ev.clientX, ev.clientY);
            onMapClick({ x: p.x, y: p.y });
          }
        }}
      >
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" className="size-full select-none">
          <defs>
            <pattern id="rows" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
              <rect width="8" height="3" fill="var(--terrain-5)" />
            </pattern>
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {mode !== "none" && (
              <g opacity={opacity}>
                {(mode === "ortho" || mode === "vari" || mode === "exg" || mode === "gli") && (
                  <>
                    <Fields v={variant} mode={mode} />
                    {mode === "ortho" && (
                      <>
                        <path d="M-20 520 C 180 470, 300 600, 480 560 S 760 430, 1020 470" stroke="var(--terrain-water)" strokeWidth={18} fill="none" />
                        <path d="M-20 520 C 180 470, 300 600, 480 560 S 760 430, 1020 470" stroke="var(--terrain-5)" strokeWidth={46} fill="none" opacity={0.55} />
                        <path d="M140 -10 L 220 300 L 260 710" stroke="var(--terrain-road)" strokeWidth={7} fill="none" />
                        <path d="M -10 210 L 1010 260" stroke="var(--terrain-road)" strokeWidth={5} fill="none" />
                        <Trees v={variant} />
                      </>
                    )}
                  </>
                )}
                {(mode === "hypso" || mode === "slope" || mode === "mdt" || mode === "mds") &&
                  z.map((row, j) =>
                    row.map((ev, i) => {
                      let fill: string;
                      if (mode === "slope") {
                        const gx = (row[i + 1] ?? ev) - ev, gy = (z[j + 1]?.[i] ?? ev) - ev;
                        fill = hypsoColor(Math.min(1, Math.hypot(gx, gy) * 28));
                      } else if (mode === "hypso") fill = hypsoColor((ev - min) / (max - min));
                      else {
                        const t = (ev - min) / (max - min) + (mode === "mds" ? (seeded(i * 97 + j * 13)() > 0.85 ? 0.12 : 0) : 0);
                        fill = `color-mix(in oklab, var(--sidebar) ${Math.round((1 - t) * 100)}%, var(--sidebar-accent-foreground))`;
                      }
                      return <rect key={`${i}-${j}`} x={i * CELL - CELL / 2} y={j * CELL - CELL / 2} width={CELL + 0.6} height={CELL + 0.6} fill={fill} />;
                    }),
                  )}
                {hillshade && <rect width={MAP_W} height={MAP_H} fill="url(#rows)" opacity={0.06} />}
              </g>
            )}
            {contours && (
              <g fill="none">
                {paths.map((p, idx) => (
                  <path key={p.lv} d={p.d} stroke={idx % 5 === 0 ? "var(--warning)" : "var(--info)"} strokeWidth={(idx % 5 === 0 ? 1.8 : 0.9) / view.k} opacity={0.9} />
                ))}
              </g>
            )}
            {children}
          </g>
        </svg>
      </div>
      {overlay}
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border bg-card/90 shadow-sm backdrop-blur">
        <button aria-label="Aproximar" className="grid size-8 place-items-center hover:bg-accent" onClick={() => zoomAt(MAP_W / 2, MAP_H / 2, view.k * 1.4)}><Plus className="size-4" /></button>
        <button aria-label="Afastar" className="grid size-8 place-items-center border-t hover:bg-accent" onClick={() => zoomAt(MAP_W / 2, MAP_H / 2, view.k / 1.4)}><Minus className="size-4" /></button>
        <button aria-label="Enquadrar" className="grid size-8 place-items-center border-t hover:bg-accent" onClick={() => setView({ k: 1, x: 0, y: 0 })}><Maximize2 className="size-3.5" /></button>
      </div>
      {showFooter && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-card/90 px-3 py-1 font-mono text-[10.5px] text-muted-foreground backdrop-blur">
          <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-12 border-x border-b border-foreground/60" />{Math.round(100 / view.k)} m</span>
          <span>{N.toFixed(6)}°, {E.toFixed(6)}°</span>
          <span>Alt. {altitude(e)} m</span>
          <span className="hidden sm:inline">SIRGAS 2000 / UTM 22S (EPSG:31982)</span>
          <span className="ml-auto flex items-center gap-1"><Layers className="size-3" /> Zoom {(16 + Math.log2(view.k)).toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

function Trees({ v }: { v: number }) {
  const t = useMemo(() => {
    const r = seeded(v + 11);
    return Array.from({ length: 140 }, () => {
      const x = r() * 1000;
      const y = 470 + Math.sin(x / 160) * 40 + (r() - 0.5) * 90;
      return { x, y, r: 5 + r() * 7 };
    });
  }, [v]);
  return <g>{t.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="var(--terrain-5)" opacity={0.85} />)}</g>;
}

export const altitudeAt = (x: number, y: number, v = 1) => altitude(elevation(x, y, v));

export function HypsoLegend({ from = 712, to = 852, label = "Altitude (m)" }: { from?: number; to?: number; label?: string }) {
  return (
    <div className="rounded-md border bg-card/90 p-2 text-[10px] shadow-sm backdrop-blur">
      <p className="mb-1 font-semibold">{label}</p>
      <div className="h-2 w-36 rounded-sm" style={{ background: "linear-gradient(90deg, var(--hypso-1), var(--hypso-2), var(--hypso-3), var(--hypso-4), var(--hypso-5))" }} />
      <div className="mt-0.5 flex justify-between text-muted-foreground"><span>{from}</span><span>{to}</span></div>
    </div>
  );
}

export function MapThumb({ variant = 1, mode = "ortho", className }: { variant?: number; mode?: MapMode; className?: string }) {
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" className={cn("block bg-[var(--sidebar)]", className)} aria-hidden>
      <defs>
        <pattern id={`rows-t${variant}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="8" height="3" fill="var(--terrain-5)" /></pattern>
      </defs>
      <Fields v={variant} mode={mode} />
      <path d="M-20 520 C 180 470, 300 600, 480 560 S 760 430, 1020 470" stroke="var(--terrain-water)" strokeWidth={18} fill="none" />
      <path d="M140 -10 L 220 300 L 260 710" stroke="var(--terrain-road)" strokeWidth={7} fill="none" />
      <Trees v={variant} />
    </svg>
  );
}
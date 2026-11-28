"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { elevation, MAP_W, MAP_H } from "./AerialMap";
import { seeded } from "../../lib/mock-data";
import { cn } from "../../lib/utils";

export type CloudColor = "rgb" | "altitude" | "classe";

function cssVar(name: string) {
  return getComputedStyle(document.querySelector(".geomap-surface") ?? document.documentElement).getPropertyValue(name).trim();
}

/** Canvas point-cloud renderer with orbit (drag), zoom (wheel) and elevation clipping. */
export function PointCloud({ color = "altitude", clip = [0, 1], pointSize = 1.6, mesh = false, className, autoRotate = false, variant = 1 }: {
  color?: CloudColor; clip?: [number, number]; pointSize?: number; mesh?: boolean; className?: string; autoRotate?: boolean; variant?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState({ yaw: 0.6, pitch: 0.9, dist: 1.0 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const drag = useRef<{ x: number; y: number } | null>(null);

  const pts = useMemo(() => {
    const r = seeded(variant * 13 + 5);
    const out: { x: number; y: number; z: number; t: number; cls: number; shade: number }[] = [];
    let min = 9, max = -9;
    const raw: { x: number; y: number; e: number; cls: number }[] = [];
    for (let i = 0; i < 16000; i++) {
      const mx = r() * MAP_W, my = r() * MAP_H;
      let e = elevation(mx, my, variant);
      let cls = 0;
      const tree = r() < 0.08 && Math.abs(my - (470 + Math.sin(mx / 160) * 40)) < 60;
      if (tree) { e += 0.03 + r() * 0.05; cls = 1; }
      if (mx > 600 && mx < 700 && my > 100 && my < 180) { e += 0.06; cls = 2; }
      raw.push({ x: mx, y: my, e, cls });
      min = Math.min(min, e); max = Math.max(max, e);
    }
    for (const p of raw) out.push({ x: p.x / MAP_W - 0.5, y: p.y / MAP_H - 0.5, z: (p.e - min) * 0.5, t: (p.e - min) / (max - min), cls: p.cls, shade: 0.75 + ((p.x * 7 + p.y * 3) % 25) / 100 });
    return out;
  }, [variant]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      setCam((c) => ({ ...c, dist: Math.min(3, Math.max(0.35, c.dist * Math.exp(dy * 0.0015))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!autoRotate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCam((c) => ({ ...c, yaw: c.yaw + 0.01 })), 40);
    return () => clearInterval(id);
  }, [autoRotate]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth, h = el.clientHeight;
    el.width = w * dpr; el.height = h * dpr;
    const ctx = el.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = cssVar("--sidebar");
    ctx.fillRect(0, 0, w, h);
    const stops = ["--hypso-1", "--hypso-2", "--hypso-3", "--hypso-4", "--hypso-5"].map(cssVar);
    const terr = ["--terrain-2", "--terrain-5", "--terrain-road"].map(cssVar);
    const clsC = [cssVar("--terrain-3"), cssVar("--success"), cssVar("--info")];
    const { yaw, pitch, dist } = cam;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = Math.min(w, h) * 1.15 / dist;
    const proj = pts.filter((p) => p.t >= clip[0] && p.t <= clip[1]).map((p) => {
      const x1 = p.x * cy - p.y * sy, y1 = p.x * sy + p.y * cy;
      const y2 = y1 * cp - p.z * sp, z2 = y1 * sp + p.z * cp;
      return { sx: w / 2 + x1 * scale, sy: h / 2 + y2 * scale * 0.9 + 20, depth: z2, p };
    }).sort((a, b) => b.depth - a.depth);
    for (const q of proj) {
      const p = q.p;
      const c = color === "altitude" ? stops[Math.min(4, Math.floor(p.t * 5))]! : color === "classe" ? clsC[p.cls]! : terr[p.cls === 1 ? 1 : p.cls === 2 ? 2 : 0]!;
      ctx.globalAlpha = color === "rgb" ? p.shade : 0.95;
      ctx.fillStyle = c;
      const s = mesh ? pointSize * 2.6 : pointSize;
      ctx.fillRect(q.sx, q.sy, s, s);
    }
    ctx.globalAlpha = 1;
  }, [cam, pts, color, clip, pointSize, mesh]);

  return (
    <canvas
      ref={canvas}
      className={cn("size-full cursor-grab touch-none rounded-lg active:cursor-grabbing", className)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setCam((c) => ({ ...c, yaw: c.yaw + dx * 0.008, pitch: Math.min(1.5, Math.max(0.1, c.pitch + dy * 0.006)) }));
      }}
      onPointerUp={() => { drag.current = null; }}
    />
  );
}
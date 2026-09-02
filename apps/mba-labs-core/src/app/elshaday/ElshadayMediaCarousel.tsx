"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ElshadayMediaCarouselItem = {
  id: string;
  href?: string | null;
  title?: string | null;
  subtitle?: string | null;
  imageUrl: string;
};

export function ElshadayMediaCarousel({
  items
}: {
  items: ElshadayMediaCarouselItem[];
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (!items.length) return null;

  const active = items[index];

  function move(delta: number) {
    setIndex((current) => (current + delta + items.length) % items.length);
  }

  const slide = (
    <div className="relative block aspect-[16/10] w-full sm:aspect-[16/9]">
      <img
        alt={active.title || "Destaque da igreja"}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        src={active.imageUrl}
      />
      {active.title || active.subtitle ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/28 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
            {active.subtitle ? (
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-white [text-shadow:0_1px_5px_rgba(0,0,0,.55)]">
                {active.subtitle}
              </p>
            ) : null}
            {active.title ? (
              <h2 className="mt-1 line-clamp-2 text-[clamp(1.35rem,6vw,2rem)] font-black leading-tight tracking-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,.55)]">
                {active.title}
              </h2>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <section
      aria-label="Destaques"
      className="relative overflow-hidden rounded-[28px] bg-slate-900 shadow-[0_16px_38px_rgba(15,23,42,.16)]"
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = event.changedTouches[0]?.clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(delta) < 45) return;
        move(delta < 0 ? 1 : -1);
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
    >
      {active.href ? (
        <Link className="block" href={active.href}>
          {slide}
        </Link>
      ) : (
        slide
      )}

      {items.length > 1 ? (
        <>
          <button
            aria-label="Anterior"
            className="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur sm:grid"
            onClick={() => move(-1)}
            type="button"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            aria-label="Próximo"
            className="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur sm:grid"
            onClick={() => move(1)}
            type="button"
          >
            <ChevronRight size={19} />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((item, itemIndex) => (
              <button
                aria-label={"Ir para destaque " + (itemIndex + 1)}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (itemIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/55")
                }
                key={item.id}
                onClick={() => setIndex(itemIndex)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

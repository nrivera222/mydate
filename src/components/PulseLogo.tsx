"use client";

import { useEffect, useRef } from "react";
import { mountPulseLogo, type PulseLogoOptions } from "@/lib/pulse-logo";

// Logotipo TWO LOVE animado con el efecto "Pulse Sphere" (intro de ensamblado + bucle de latidos).
// El wordmark y el claim se cargan como SVG vectoriales de public/brand/logo.

type Props = Omit<PulseLogoOptions, "wordmark" | "tagline"> & { tag?: "es" | "en"; className?: string; label?: string };

export function PulseLogo({ className = "", label = "TWO LOVE", tag, layout = "symbol", ...opts }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(opts);
  useEffect(() => {
    let handle: { destroy: () => void } | null = null, cancelled = false;
    const load = (src: string | null) =>
      new Promise<HTMLImageElement | null>((ok) => {
        if (!src) return ok(null);
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => ok(null);
        img.src = src;
      });
    // En móvil, menos partículas
    const small = window.innerWidth < 640;
    const o: PulseLogoOptions = JSON.parse(key);
    Promise.all([
      load(layout === "symbol" ? null : "/brand/logo/two-love-wordmark-tight.svg"),
      load(layout === "stacked" && tag ? `/brand/logo/two-love-tagline-${tag}.svg` : null),
    ]).then(([wordmark, tagline]) => {
      if (cancelled || !ref.current) return;
      handle = mountPulseLogo(ref.current, { ...o, layout, wordmark, tagline, particles: Math.round((o.particles ?? 2600) * (small ? 0.55 : 1)) });
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [key, layout, tag]);
  return <canvas ref={ref} className={`block h-full w-full ${className}`} role="img" aria-label={label} />;
}

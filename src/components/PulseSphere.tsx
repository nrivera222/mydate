"use client";

import { useEffect, useRef } from "react";
import { mountPulseSphere, type PulseSphereOptions } from "@/lib/pulse-sphere";

// Esfera de energía "pulse sphere": miles de partículas luminosas en una esfera que late,
// filamentos de luz en órbita, núcleo de plasma, niebla volumétrica y profundidad de campo.

export function PulseSphere({ className = "", particles = 3600, still = false, time = 2.1 }: PulseSphereOptions & { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => mountPulseSphere(ref.current!, { particles, still, time }).destroy, [particles, still, time]);
  return <canvas ref={ref} className={`block h-full w-full ${className}`} aria-hidden="true" />;
}

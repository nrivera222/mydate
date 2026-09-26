import { useId } from "react";
import { pulseSphere } from "@/lib/logo";

/** Símbolo "pulse sphere": esfera de latitudes con un latido que recorre el ecuador. */
export function LogoMark({ size = 40, animated = true, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const lines = pulseSphere(50, 50, 40);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label="TWO LOVE">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5efe3" />
          <stop offset="0.45" stopColor="#e6c77a" />
          <stop offset="1" stopColor="#c9a24b" />
        </linearGradient>
        <radialGradient id={`${id}h`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e6c77a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e6c77a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}f`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}h)`} className={animated ? "logo-halo" : ""} />
      <circle cx="50" cy="50" r="41" fill="none" stroke={`url(#${id}g)`} strokeWidth="0.5" opacity="0.35" />
      <g fill="none" stroke={`url(#${id}g)`} strokeLinecap="round" strokeLinejoin="round">
        {lines.map((l, i) => (
          <path key={i} d={l.d} strokeWidth={l.weight} opacity={l.opacity} filter={l.central ? `url(#${id}f)` : undefined} />
        ))}
      </g>
      {animated && lines.filter((l) => l.central).map((l, i) => (
        // Destello que recorre el latido de izquierda a derecha
        <path key={`p${i}`} d={l.d} pathLength={100} fill="none" stroke="#fffaf0" strokeWidth={2.2} strokeLinecap="round" className="logo-pulse" filter={`url(#${id}f)`} />
      ))}
    </svg>
  );
}

/** Logotipo completo: símbolo + nombre de marca. */
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} dir="ltr">
      <LogoMark size={size} />
      <span className="gold-text">TWO LOVE</span>
    </span>
  );
}

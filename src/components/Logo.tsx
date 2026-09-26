
/** Símbolo de marca "Pulse Sphere": esfera de partículas, latido y dos órbitas entrelazadas (public/brand/logo). */
export function LogoMark({ size = 40, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  // Por debajo de 48 px se usa el icono simplificado (orbe sólido), legible a tamaños pequeños
  const src = size < 48 ? "/brand/logo/two-love-symbol-icon.svg" : "/brand/logo/two-love-symbol.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="TWO LOVE" className={`shrink-0 ${className}`} />;
}

/** Logotipo completo: símbolo + nombre de marca. */
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} dir="ltr">
      <LogoMark size={size} />
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/logo/two-love-wordmark.svg" alt="TWO LOVE" style={{ height: size * 0.42 }} />
    </span>
  );
}

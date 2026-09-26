// Geometría del logotipo TWO LOVE: una esfera de latitudes atravesada por un pulso cardíaco.
// Función pura, usable en componentes y en el script que genera el favicon.

export type SphereLine = { d: string; y: number; weight: number; opacity: number; central: boolean };

const gauss = (u: number, mu: number, sigma: number) => Math.exp(-((u - mu) ** 2) / (2 * sigma ** 2));

/** Latido estilizado (onda P, complejo QRS y onda T) sobre u ∈ [-1, 1]. */
export function heartbeat(u: number) {
  return 0.16 * gauss(u, -0.42, 0.07) - 0.22 * gauss(u, -0.09, 0.03) + 1 * gauss(u, 0, 0.035) - 0.5 * gauss(u, 0.09, 0.035) + 0.26 * gauss(u, 0.4, 0.09);
}

/**
 * Líneas de la esfera centrada en (cx, cy) con radio r.
 * Las latitudes se reparten por ángulo para que se agrupen hacia los polos (efecto 3D)
 * y el pulso se atenúa al alejarse del ecuador.
 */
export function pulseSphere(cx: number, cy: number, r: number, lines = 13, samples = 140): SphereLine[] {
  const out: SphereLine[] = [];
  const mid = (lines - 1) / 2;
  for (let i = 0; i < lines; i++) {
    const phi = ((i - mid) / (mid + 1)) * (Math.PI / 2);
    const yRel = Math.sin(phi); // -1..1
    const half = Math.cos(phi); // semiancho relativo de la latitud
    const amp = r * 0.34 * Math.exp(-(yRel ** 2) * 9);
    const pts: string[] = [];
    for (let s = 0; s <= samples; s++) {
      const u = -1 + (2 * s) / samples;
      const x = cx + u * half * r;
      // El pulso recorre el ecuador; en las latitudes cercanas se ve como eco más suave
      const y = cy + yRel * r - amp * heartbeat(u) * (1 - u * u * 0.35);
      pts.push(`${s === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    const central = i === Math.round(mid);
    out.push({ d: pts.join(""), y: yRel, weight: central ? 1.6 : 0.6 + 0.8 * half, opacity: central ? 1 : 0.25 + 0.6 * half, central });
  }
  return out;
}

/** SVG autónomo del símbolo (para favicon y descargas). */
export function logoSvg(size = 64, background = true) {
  const r = size * 0.4;
  const c = size / 2;
  const lines = pulseSphere(c, c, r, size <= 64 ? 9 : 13, size <= 64 ? 80 : 160);
  const stroke = (l: SphereLine) =>
    `<path d="${l.d}" fill="none" stroke="url(#g)" stroke-width="${((l.weight * size) / (size <= 64 ? 55 : 190)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${l.opacity.toFixed(2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5efe3"/><stop offset=".45" stop-color="#e6c77a"/><stop offset="1" stop-color="#c9a24b"/></linearGradient>
<radialGradient id="bg" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#2a2114"/><stop offset="1" stop-color="#0b0a09"/></radialGradient></defs>
${background ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>` : ""}
<circle cx="${c}" cy="${c}" r="${(r * 1.02).toFixed(2)}" fill="none" stroke="url(#g)" stroke-width="${(size / 220).toFixed(2)}" opacity=".35"/>
${lines.map(stroke).join("\n")}
</svg>`;
}

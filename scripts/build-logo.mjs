// Sistema de logotipo TWO LOVE basado en el visual "Pulse Sphere".
// Símbolo: esfera de partículas atravesada por un latido, con dos órbitas entrelazadas ("two").
// Genera SVG vectoriales (texto convertido a trazos) en public/brand/logo/.
// Uso: node scripts/build-logo.mjs
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "public/brand/logo");
fs.mkdirSync(OUT, { recursive: true });

const font = (pkg, file) => {
  const buf = fs.readFileSync(path.join(root, "node_modules/@fontsource", pkg, "files", file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const DISPLAY = font("syncopate", "syncopate-latin-700-normal.woff");
const TEXT = font("montserrat", "montserrat-latin-500-normal.woff");

// ── Paleta ────────────────────────────────────────────────────────────────────
export const COLORS = {
  space: "#05040F",
  night: "#0B0A1F",
  electric: "#38BDF8",
  blue: "#3B82F6",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  neon: "#C026D3",
  magenta: "#E879F9",
  ivory: "#F5F3FF",
};

const VARIANTS = {
  color: { stops: [COLORS.electric, COLORS.indigo, "#A855F7", COLORS.magenta], ring: [[COLORS.electric, COLORS.blue], ["#A855F7", COLORS.magenta]], pulse: "#FFFFFF", glow: true, text: COLORS.ivory, love: true },
  light: { stops: ["#0284C7", "#4F46E5", "#7C3AED", "#C026D3"], ring: [["#0284C7", "#2563EB"], ["#7C3AED", "#C026D3"]], pulse: COLORS.night, glow: false, text: COLORS.night, love: true },
  white: { mono: "#FFFFFF", pulse: "#FFFFFF", text: "#FFFFFF" },
  black: { mono: "#000000", pulse: "#000000", text: "#000000" },
};

// ── Geometría ─────────────────────────────────────────────────────────────────
const f = (n) => +n.toFixed(2);
const gauss = (u, mu, s) => Math.exp(-((u - mu) ** 2) / (2 * s * s));
const heartbeat = (u) => 0.16 * gauss(u, -0.42, 0.07) - 0.22 * gauss(u, -0.09, 0.03) + gauss(u, 0, 0.035) - 0.5 * gauss(u, 0.09, 0.035) + 0.26 * gauss(u, 0.4, 0.09);

function rotate([x, y, z], ax, ay) {
  const x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay);
  return [x1, y * Math.cos(ax) - z1 * Math.sin(ax), y * Math.sin(ax) + z1 * Math.cos(ax)];
}

/**
 * Símbolo en un lienzo de 512×512 centrado en (256,256).
 * detail "full" para usos medianos/grandes; "small" (menos partículas, trazos más gruesos) para iconos y favicon.
 */
export function symbol(variant = "color", { detail = "full", id = "tl" } = {}) {
  const v = VARIANTS[variant];
  const c = 256, R = 150;
  const icon = detail === "icon";
  const small = detail === "small" || icon;
  const N = small ? 90 : 760;
  const fill = v.mono ?? `url(#${id}-g)`;
  const defs = [];
  const back = [], dots = [], front = [];

  if (!v.mono) {
    defs.push(`<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${c - R}" y1="${c - R}" x2="${c + R}" y2="${c + R}">${v.stops.map((s, i) => `<stop offset="${i / (v.stops.length - 1)}" stop-color="${s}"/>`).join("")}</linearGradient>`);
    v.ring.forEach((r, i) => defs.push(`<linearGradient id="${id}-r${i}" gradientUnits="userSpaceOnUse" x1="${c - R * 1.4}" y1="${c}" x2="${c + R * 1.4}" y2="${c}"><stop offset="0" stop-color="${r[0]}"/><stop offset="1" stop-color="${r[1]}"/></linearGradient>`));
  }
  if (v.glow) {
    defs.push(`<radialGradient id="${id}-core" cx="${c}" cy="${c}" r="${R * 1.05}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E0E7FF" stop-opacity=".75"/><stop offset=".25" stop-color="${COLORS.violet}" stop-opacity=".45"/><stop offset=".7" stop-color="#4C1D95" stop-opacity=".12"/><stop offset="1" stop-color="#1E1B4B" stop-opacity="0"/></radialGradient>`);
    defs.push(`<filter id="${id}-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${small ? 7 : 5}"/></filter>`);
    back.push(`<circle cx="${c}" cy="${c}" r="${R * 1.05}" fill="url(#${id}-core)"/>`);
  }

  // Órbitas: dos anillos inclinados que se entrelazan alrededor de la esfera (la pareja)
  const rings = [{ tilt: -32, rx: R * 1.3, ry: R * 0.36 }, { tilt: 32, rx: R * 1.3, ry: R * 0.36 }];
  const ringW = small ? 13 : 7;
  rings.forEach((r, i) => {
    const arc = (a0, a1) => {
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const a = a0 + ((a1 - a0) * k) / 60;
        const x = Math.cos(a) * r.rx, y = Math.sin(a) * r.ry, t = (r.tilt * Math.PI) / 180;
        pts.push(`${k ? "L" : "M"}${f(c + x * Math.cos(t) - y * Math.sin(t))} ${f(c + x * Math.sin(t) + y * Math.cos(t))}`);
      }
      return pts.join("");
    };
    const stroke = v.mono ?? `url(#${id}-r${i})`;
    back.push(`<path d="${arc(Math.PI, 2 * Math.PI)}" fill="none" stroke="${stroke}" stroke-width="${ringW * 0.55}" stroke-linecap="round" opacity="${v.mono ? 0.5 : 0.45}"/>`);
    if (v.glow) front.push(`<path d="${arc(0.05, Math.PI - 0.05)}" fill="none" stroke="${stroke}" stroke-width="${ringW * 2.4}" stroke-linecap="round" opacity=".35" filter="url(#${id}-blur)"/>`);
    front.push(`<path d="${arc(0, Math.PI)}" fill="none" stroke="${stroke}" stroke-width="${ringW}" stroke-linecap="round"/>`);
    // Nodo luminoso en cada órbita (las "cabezas" de los filamentos del visual)
    const a = i ? 0.55 : Math.PI - 0.55, t = (r.tilt * Math.PI) / 180;
    const nx = c + Math.cos(a) * r.rx * Math.cos(t) - Math.sin(a) * r.ry * Math.sin(t), ny = c + Math.cos(a) * r.rx * Math.sin(t) + Math.sin(a) * r.ry * Math.cos(t);
    if (v.glow) front.push(`<circle cx="${f(nx)}" cy="${f(ny)}" r="${small ? 22 : 15}" fill="#fff" opacity=".45" filter="url(#${id}-blur)"/>`);
    front.push(`<circle cx="${f(nx)}" cy="${f(ny)}" r="${small ? 12 : 8}" fill="${v.glow ? "#fff" : v.mono ?? v.stops[i ? 3 : 0]}"/>`);
  });

  // Esfera de partículas (Fibonacci), con profundidad: delante grandes y opacas, detrás pequeñas y tenues
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    const [x, yy, z] = rotate([Math.cos(th) * rr, y, Math.sin(th) * rr], 0.42, 0.6);
    pts.push({ x, y: yy, z });
  }
  pts.sort((a, b) => b.z - a.z);
  if (icon) {
    // Orbe sólido: legible a 16–48 px
    defs.push(`<radialGradient id="${id}-orb" cx="${c - R * 0.3}" cy="${c - R * 0.35}" r="${R * 1.5}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${v.mono ?? v.stops[0]}"/><stop offset=".55" stop-color="${v.mono ?? v.stops[2]}"/><stop offset="1" stop-color="${v.mono ?? "#3B0764"}"/></radialGradient>`);
    dots.push(`<circle cx="${c}" cy="${c}" r="${R}" fill="url(#${id}-orb)"/>`);
    pts.length = 0;
  }
  for (const p of pts) {
    const depth = (1 - p.z) / 2; // 1 delante, 0 detrás
    const size = (small ? 8.5 : 2.5) * (0.4 + 0.8 * depth) * (1 + (1 - Math.abs(p.y)) * 0.15);
    const op = v.mono ? (depth > 0.45 ? 1 : 0.45) : 0.28 + 0.72 * depth;
    dots.push(`<circle cx="${f(c + p.x * R)}" cy="${f(c + p.y * R)}" r="${f(size)}" fill="${fill}"${op < 1 ? ` opacity="${f(op)}"` : ""}/>`);
  }

  // Latido que atraviesa el ecuador
  const ecg = [];
  for (let k = 0; k <= 160; k++) {
    const u = -1 + (2 * k) / 160;
    ecg.push(`${k ? "L" : "M"}${f(c + u * R * 0.78)} ${f(c - heartbeat(u) * R * 0.56)}`);
  }
  if (!v.mono) defs.push(`<linearGradient id="${id}-p" gradientUnits="userSpaceOnUse" x1="${c - R * 0.8}" y1="${c}" x2="${c + R * 0.8}" y2="${c}"><stop offset="0" stop-color="${v.glow ? COLORS.electric : v.stops[0]}" stop-opacity="${v.glow ? 0.2 : 0.4}"/><stop offset=".5" stop-color="${v.pulse}"/><stop offset="1" stop-color="${v.glow ? COLORS.magenta : v.stops[3]}" stop-opacity="${v.glow ? 0.2 : 0.4}"/></linearGradient>`);
  const ecgPath = ecg.join("");
  const ecgW = small ? 15 : 6;
  if (v.glow) front.push(`<path d="${ecgPath}" fill="none" stroke="${COLORS.electric}" stroke-width="${ecgW * 3}" stroke-linecap="round" stroke-linejoin="round" opacity=".4" filter="url(#${id}-blur)"/>`);
  front.push(`<path d="${ecgPath}" fill="none" stroke="${v.mono ? v.pulse : `url(#${id}-p)`}" stroke-width="${ecgW}" stroke-linecap="round" stroke-linejoin="round"/>`);

  return { defs: defs.join(""), body: back.join("") + dots.join("") + front.join("") };
}

// ── Tipografía convertida a trazos ────────────────────────────────────────────
function textPath(fontObj, text, size, tracking = 0) {
  let x = 0;
  const parts = [];
  for (const ch of text) {
    if (ch !== " ") {
      const p = fontObj.getPath(ch, x, 0, size);
      parts.push(p.toPathData(2));
    }
    x += fontObj.getAdvanceWidth(ch, size) + tracking * size;
  }
  const width = x - tracking * size;
  const bb = fontObj.getPath("H", 0, 0, size).getBoundingBox();
  return { d: parts.join(""), width, capHeight: -bb.y1 };
}

function wordmark(variant, { size = 100, id = "tl" } = {}) {
  const v = VARIANTS[variant];
  const tr = 0.18;
  const two = textPath(DISPLAY, "TWO", size, tr);
  const love = textPath(DISPLAY, "LOVE", size, tr);
  const gap = size * 0.55;
  const width = two.width + gap + love.width;
  const loveFill = v.love ? `url(#${id}-w)` : v.text;
  const defs = v.love ? `<linearGradient id="${id}-w" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${f(love.width)}" y2="0">${v.stops.map((s, i) => `<stop offset="${i / (v.stops.length - 1)}" stop-color="${s}"/>`).join("")}</linearGradient>` : "";
  const body = `<path d="${two.d}" fill="${v.text}"/><g transform="translate(${f(two.width + gap)} 0)"><path d="${love.d}" fill="${loveFill}"/></g>`;
  return { defs, body, width, height: two.capHeight };
}

function tagline(text, variant, size) {
  const t = textPath(TEXT, text, size, 0.42);
  const v = VARIANTS[variant];
  const col = v.mono ?? (variant === "light" ? "#4B5563" : "#A5B4FC");
  return { body: `<path d="${t.d}" fill="${col}"/>`, width: t.width, height: t.capHeight };
}

const svg = (w, h, defs, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${Math.round(w)}" height="${Math.round(h)}"><defs>${defs}</defs>${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}${body}</svg>\n`;

// ── Composiciones ─────────────────────────────────────────────────────────────
export function horizontal(variant) {
  const H = 512; // alto del símbolo
  const wm = wordmark(variant, { size: 120, id: `h${variant}` });
  const s = symbol(variant, { id: `hs${variant}` });
  const gap = 70, pad = 40;
  const w = pad + H + gap + wm.width + pad, h = H;
  const body = `<g transform="translate(${pad} 0)">${s.body}</g><g transform="translate(${f(pad + H + gap)} ${f(H / 2 + wm.height / 2)})">${wm.body}</g>`;
  return svg(w, h, s.defs + wm.defs, body);
}

export function stacked(variant, tag) {
  const H = 512;
  const wm = wordmark(variant, { size: 120, id: `v${variant}` });
  const s = symbol(variant, { id: `vs${variant}` });
  const tg = tag ? tagline(tag, variant, 34) : null;
  const w = Math.max(H, wm.width, tg?.width ?? 0) + 120;
  const h = H + 40 + wm.height + (tg ? 70 + tg.height : 0) + 60;
  let body = `<g transform="translate(${f((w - H) / 2)} 0)">${s.body}</g>`;
  body += `<g transform="translate(${f((w - wm.width) / 2)} ${f(H + 40 + wm.height)})">${wm.body}</g>`;
  if (tg) body += `<g transform="translate(${f((w - tg.width) / 2)} ${f(H + 40 + wm.height + 70 + tg.height)})">${tg.body}</g>`;
  return svg(w, h, s.defs + wm.defs, body);
}

export function symbolOnly(variant, detail = "full") {
  const s = symbol(variant, { detail, id: `s${variant}${detail}` });
  return svg(512, 512, s.defs, s.body);
}

export function wordmarkOnly(variant) {
  const wm = wordmark(variant, { size: 120, id: `w${variant}` });
  const pad = 30;
  return svg(wm.width + pad * 2, wm.height + pad * 2, wm.defs, `<g transform="translate(${pad} ${f(pad + wm.height)})">${wm.body}</g>`);
}

/** Icono de app / avatar: símbolo simplificado sobre fondo espacial (recorte circular seguro). */
export function favicon() {
  const s = symbol("color", { detail: "icon", id: "fav" });
  return svg(512, 512, s.defs, `<rect width="512" height="512" rx="112" fill="${COLORS.space}"/><g transform="translate(256 256) scale(1.18) translate(-256 -256)">${s.body}</g>`);
}

export function appIcon() {
  const s = symbol("color", { detail: "small", id: "app" });
  const defs = s.defs + `<radialGradient id="app-bg" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#1E1150"/><stop offset=".55" stop-color="#0B0A1F"/><stop offset="1" stop-color="${COLORS.space}"/></radialGradient>`;
  return svg(1024, 1024, defs, `<rect width="1024" height="1024" fill="url(#app-bg)"/><g transform="translate(512 512) scale(1.55) translate(-256 -256)">${s.body}</g>`);
}

// ── Escritura ─────────────────────────────────────────────────────────────────
const files = {
  "two-love-symbol.svg": symbolOnly("color"),
  "two-love-symbol-light.svg": symbolOnly("light"),
  "two-love-symbol-white.svg": symbolOnly("white"),
  "two-love-symbol-black.svg": symbolOnly("black"),
  "two-love-symbol-small.svg": symbolOnly("color", "small"),
  "two-love-symbol-icon.svg": symbolOnly("color", "icon"),
  "two-love-logo-horizontal.svg": horizontal("color"),
  "two-love-logo-horizontal-light.svg": horizontal("light"),
  "two-love-logo-horizontal-white.svg": horizontal("white"),
  "two-love-logo-horizontal-black.svg": horizontal("black"),
  "two-love-logo-stacked.svg": stacked("color"),
  "two-love-logo-stacked-light.svg": stacked("light"),
  "two-love-logo-stacked-white.svg": stacked("white"),
  "two-love-logo-stacked-black.svg": stacked("black"),
  "two-love-logo-stacked-tagline-en.svg": stacked("color", "VERIFIED LUXURY DATING"),
  "two-love-logo-stacked-tagline-es.svg": stacked("color", "CITAS VERIFICADAS DE LUJO"),
  "two-love-wordmark.svg": wordmarkOnly("color"),
  "two-love-wordmark-light.svg": wordmarkOnly("light"),
  "two-love-wordmark-white.svg": wordmarkOnly("white"),
  "two-love-wordmark-black.svg": wordmarkOnly("black"),
  "two-love-app-icon.svg": appIcon(),
  "two-love-favicon.svg": favicon(),
};

if (process.argv[1] === import.meta.filename) {
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), content);
  console.log(`${Object.keys(files).length} SVG en public/brand/logo/`);
}

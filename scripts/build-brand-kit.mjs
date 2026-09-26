// Kit de marca TWO LOVE para publicidad y redes sociales.
// Exporta PNG del logotipo, piezas para RRSS y anuncios (ES/EN) y el manual de marca en PDF.
// Requisitos: `npm i -D playwright` (o CHROMIUM=/ruta/a/chrome). Antes: node scripts/build-logo.mjs && node scripts/build-visual.mjs
// Uso: node scripts/build-brand-kit.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { COLORS } from "./build-logo.mjs";

const root = path.resolve(import.meta.dirname, "..");
const BRAND = path.join(root, "public/brand");
const LOGO = path.join(BRAND, "logo");
const OUT = path.join(BRAND, "kit");
const url = (p) => `file://${p}`;
const font = (w) => url(path.join(root, `node_modules/@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff2`));
const syncopate = url(path.join(root, "node_modules/@fontsource/syncopate/files/syncopate-latin-700-normal.woff2"));
for (const d of ["logo-png", "social", "ads", "guide"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const TMP = path.join(OUT, ".tmp.html");

async function shoot(html, w, h, file, { transparent = false, scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  fs.writeFileSync(TMP, html);
  await page.goto(url(TMP));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete) && (!document.querySelector("canvas") || document.querySelector("canvas").dataset.ready));
  const isJpg = file.endsWith(".jpg");
  await page.screenshot({ path: file, omitBackground: transparent, type: isJpg ? "jpeg" : "png", quality: isJpg ? 92 : undefined });
  await ctx.close();
}

const HEAD = `<meta charset="utf-8"><style>
@font-face{font-family:M;src:url(${font(400)})format("woff2");font-weight:400}
@font-face{font-family:M;src:url(${font(600)})format("woff2");font-weight:600}
@font-face{font-family:M;src:url(${font(700)})format("woff2");font-weight:700}
@font-face{font-family:S;src:url(${syncopate})format("woff2");font-weight:700}
*{box-sizing:border-box}html,body{margin:0;background:transparent;font-family:M,sans-serif;color:${COLORS.ivory}}
</style>`;

// ── 1. PNG del logotipo ───────────────────────────────────────────────────────
const svgSize = (file) => {
  const m = fs.readFileSync(path.join(LOGO, file), "utf8").match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return [Number(m[1]), Number(m[2])];
};
const pngs = [
  ["two-love-symbol.svg", 2048], ["two-love-symbol-light.svg", 2048], ["two-love-symbol-white.svg", 2048], ["two-love-symbol-black.svg", 2048],
  ["two-love-logo-horizontal.svg", 4000], ["two-love-logo-horizontal-light.svg", 4000], ["two-love-logo-horizontal-white.svg", 4000], ["two-love-logo-horizontal-black.svg", 4000],
  ["two-love-logo-stacked.svg", 2400], ["two-love-logo-stacked-light.svg", 2400], ["two-love-logo-stacked-white.svg", 2400], ["two-love-logo-stacked-black.svg", 2400],
  ["two-love-logo-stacked-tagline-en.svg", 2400], ["two-love-logo-stacked-tagline-es.svg", 2400],
  ["two-love-wordmark.svg", 3000], ["two-love-wordmark-light.svg", 3000], ["two-love-wordmark-white.svg", 3000], ["two-love-wordmark-black.svg", 3000],
  ["two-love-app-icon.svg", 1024],
];
for (const [file, width] of pngs) {
  const [vw, vh] = svgSize(file);
  const h = Math.round((width * vh) / vw);
  const out = path.join(OUT, "logo-png", file.replace(".svg", `-${width}.png`));
  await shoot(`${HEAD}<img src="${url(path.join(LOGO, file))}" style="display:block;width:${width}px;height:${h}px">`, width, h, out, { transparent: !file.includes("app-icon") });
}
for (const s of [16, 32, 48, 180, 192, 512]) {
  const src = s <= 48 ? "two-love-favicon.svg" : "two-love-app-icon.svg";
  await shoot(`${HEAD}<img src="${url(path.join(LOGO, src))}" style="display:block;width:${s}px;height:${s}px">`, s, s, path.join(OUT, "logo-png", `two-love-icon-${s}.png`), { transparent: true });
}
console.log("✓ PNG del logotipo");

// ── 2. Piezas para redes sociales y anuncios ──────────────────────────────────
const COPY = {
  es: { tag: "El amor también merece excelencia.", sub: "Citas verificadas de alto perfil · Dubái · Global", cta: "Solicita acceso", url: "twolove.app", tagline: "CITAS VERIFICADAS DE LUJO" },
  en: { tag: "Love deserves excellence.", sub: "Verified high-profile dating · Dubai · Global", cta: "Request access", url: "twolove.app", tagline: "VERIFIED LUXURY DATING" },
};
const logoH = url(path.join(LOGO, "two-love-logo-horizontal.svg"));
const logoS = url(path.join(LOGO, "two-love-logo-stacked.svg"));

function scene(w, h, sphere, overlay, { shade = "" } = {}) {
  const q = new URLSearchParams({ still: "1", ...sphere });
  return `${HEAD}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden;background:${COLORS.space}}
canvas{position:absolute;inset:0;width:100%;height:100%}.o{position:absolute;inset:0}
.cta{display:inline-flex;align-items:center;gap:.6em;border-radius:999px;padding:.7em 1.5em;font-weight:600;color:#fff;
background:linear-gradient(90deg,${COLORS.electric},${COLORS.indigo} 45%,${COLORS.neon});box-shadow:0 0 40px rgba(139,92,246,.55)}
.glass{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(14px);border-radius:28px}
.tag{font-weight:600;letter-spacing:-.01em;line-height:1.1}.sub{color:#C7D2FE;opacity:.85}</style>
<canvas id="c"></canvas><div class="o" style="${shade}"></div>${overlay}
<script src="${url(path.join(BRAND, "pulse-sphere.js"))}"></script>
<script>const q=new URLSearchParams(${JSON.stringify(q.toString())});mountPulseSphere(document.getElementById("c"),{particles:Number(q.get("n"))||9000,still:true,time:Number(q.get("t"))||2.12,offsetX:Number(q.get("x"))||0,offsetY:Number(q.get("y"))||0,scale:Number(q.get("s"))||1});</script>`;
}
const leftShade = "background:linear-gradient(90deg,rgba(5,4,15,.92) 0%,rgba(5,4,15,.55) 45%,transparent 70%)";
const bottomShade = "background:linear-gradient(0deg,rgba(5,4,15,.95) 0%,rgba(5,4,15,.6) 35%,transparent 60%)";

const pieces = [];
// Perfil (avatar)
pieces.push(["social/profile-avatar-1080.png", 1080, 1080, `${HEAD}<style>body{margin:0}</style><img src="${url(path.join(LOGO, "two-love-app-icon.svg"))}" style="width:1080px;height:1080px;display:block">`]);
// Portadas (solo marca, sin idioma)
const cover = (w, h, logoW, sphere, pad) =>
  scene(w, h, sphere, `<div class="o" style="display:flex;align-items:center;padding-left:${pad}px"><img src="${logoH}" style="width:${logoW}px"></div>`, { shade: leftShade });
pieces.push(["social/facebook-cover-1640x624.jpg", 1640, 624, cover(1640, 624, 760, { x: 0.28, s: 1.45, n: 11000 }, 110)]);
pieces.push(["social/x-twitter-header-1500x500.jpg", 1500, 500, cover(1500, 500, 640, { x: 0.3, s: 1.5, n: 10000 }, 90)]);
pieces.push(["social/linkedin-banner-1584x396.jpg", 1584, 396, cover(1584, 396, 520, { x: 0.36, s: 1.35, n: 9000 }, 420)]);
pieces.push(["social/youtube-banner-2560x1440.jpg", 2560, 1440,
  scene(2560, 1440, { s: 1.25, n: 16000 }, `<div class="o" style="display:flex;align-items:center;justify-content:center"><img src="${logoH}" style="width:1300px;filter:drop-shadow(0 0 40px rgba(5,4,15,.9))"></div>`,
    { shade: "background:radial-gradient(ellipse 40% 22% at 50% 50%,rgba(5,4,15,.8),transparent)" })]);

for (const lang of ["es", "en"]) {
  const c = COPY[lang];
  // Post cuadrado (feed / anuncio 1:1)
  pieces.push([`ads/${lang}/post-square-1080.jpg`, 1080, 1080, scene(1080, 1080, { y: -0.19, s: 0.8, n: 11000 },
    `<div class="o" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 80px 80px;text-align:center;gap:26px">
     <img src="${logoH}" style="width:560px"><div class="tag" style="font-size:50px">${c.tag}</div><div class="cta" style="font-size:28px">${c.cta} →</div></div>`, { shade: bottomShade })]);
  // Retrato 4:5 (feed Instagram / Meta Ads)
  pieces.push([`ads/${lang}/post-portrait-1080x1350.jpg`, 1080, 1350, scene(1080, 1350, { y: -0.21, s: 0.92, n: 12000 },
    `<div class="o" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 80px 90px;text-align:center;gap:28px">
     <img src="${logoH}" style="width:600px"><div class="tag" style="font-size:58px">${c.tag}</div><div class="sub" style="font-size:26px">${c.sub}</div>
     <div class="cta" style="font-size:30px">${c.cta} →</div></div>`, { shade: bottomShade })]);
  // Historia / Reel 9:16 (zonas seguras: 250 px arriba, 340 px abajo)
  pieces.push([`ads/${lang}/story-1080x1920.jpg`, 1080, 1920, scene(1080, 1920, { y: 0.02, s: 0.95, n: 13000 },
    `<div class="o" style="display:flex;flex-direction:column;align-items:center;padding:280px 80px 360px;text-align:center">
     <img src="${logoS}" style="width:430px"><div style="flex:1"></div>
     <div class="glass" style="padding:44px 50px;display:flex;flex-direction:column;gap:22px;align-items:center">
     <div class="tag" style="font-size:60px">${c.tag}</div><div class="sub" style="font-size:28px">${c.sub}</div><div class="cta" style="font-size:32px">${c.cta} →</div></div></div>`,
    { shade: "background:linear-gradient(0deg,rgba(5,4,15,.85),transparent 42%,transparent 62%,rgba(5,4,15,.95) 82%)" })]);
  // Horizontal 1.91:1 (Meta enlace, Google Display, LinkedIn)
  pieces.push([`ads/${lang}/landscape-1200x628.jpg`, 1200, 628, scene(1200, 628, { x: 0.25, s: 1.35, n: 10000 },
    `<div class="o" style="display:flex;flex-direction:column;justify-content:center;padding:0 70px;gap:24px;max-width:700px">
     <img src="${logoH}" style="width:470px"><div class="tag" style="font-size:44px">${c.tag}</div><div class="sub" style="font-size:20px">${c.sub}</div>
     <div><span class="cta" style="font-size:22px">${c.cta} →</span></div></div>`, { shade: leftShade })]);
  // Banners de display estándar (Google Ads)
  pieces.push([`ads/${lang}/display-300x250.jpg`, 300, 250, scene(300, 250, { y: -0.2, s: 0.72, n: 1300 },
    `<div class="o" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 16px 16px;gap:10px;text-align:center">
     <img src="${logoH}" style="width:200px"><div class="cta" style="font-size:13px;padding:.55em 1.2em">${c.cta} →</div></div>`, { shade: bottomShade })]);
  pieces.push([`ads/${lang}/display-728x90.jpg`, 728, 90, scene(728, 90, { x: 0.4, s: 1.3, n: 900 },
    `<div class="o" style="display:flex;align-items:center;justify-content:space-between;padding:0 22px">
     <img src="${logoH}" style="height:54px"><div class="tag" style="font-size:18px;flex:1;padding:0 18px">${c.tag}</div><div class="cta" style="font-size:14px;padding:.55em 1.2em">${c.cta} →</div></div>`, { shade: leftShade })]);
  pieces.push([`ads/${lang}/display-160x600.jpg`, 160, 600, scene(160, 600, { y: -0.02, s: 1.1, n: 900 },
    `<div class="o" style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:26px 12px;text-align:center">
     <img src="${logoS}" style="width:130px"><div style="display:flex;flex-direction:column;gap:14px;align-items:center"><div class="tag" style="font-size:18px">${c.tag}</div>
     <div class="cta" style="font-size:12px;padding:.55em 1em">${c.cta}</div></div></div>`, { shade: "background:linear-gradient(0deg,rgba(5,4,15,.9),transparent 50%,rgba(5,4,15,.7))" })]);
}
for (const [file, w, h, html] of pieces) {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  await shoot(html, w, h, path.join(OUT, file), { scale: w <= 728 ? 2 : 1 });
}
console.log(`✓ ${pieces.length} piezas de RRSS y anuncios`);

// ── 3. Manual de marca (PDF) ──────────────────────────────────────────────────
const L = (f) => url(path.join(LOGO, f));
const K = (f) => url(path.join(OUT, f));
const swatch = (name, hex, role) => `<div class="sw"><div style="background:${hex}"></div><b>${name}</b><span>${hex}</span><span>RGB ${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ")}</span><em>${role}</em></div>`;
const guide = `${HEAD}<style>
@page{size:297mm 210mm;margin:0}body{background:${COLORS.space};color:${COLORS.ivory}}
.p{width:297mm;height:210mm;padding:16mm 18mm;position:relative;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;gap:8mm}
h1{font-family:S;font-size:26pt;letter-spacing:.12em;margin:0}h2{font-family:S;font-size:13pt;letter-spacing:.14em;margin:0;color:#A5B4FC}
p,li{font-size:10.5pt;line-height:1.55;color:#D4D4F5;margin:0}.n{position:absolute;bottom:9mm;right:18mm;font-size:8pt;color:#6B6B9A;letter-spacing:.2em}
.g{display:grid;gap:6mm}.box{border-radius:5mm;display:flex;align-items:center;justify-content:center;padding:8mm}
.sw{display:flex;flex-direction:column;gap:1mm;font-size:8.5pt}.sw div{height:26mm;border-radius:4mm;border:1px solid rgba(255,255,255,.12)}.sw span{color:#A5A5C8}.sw em{color:#7C7CA8;font-style:normal}
.no{position:relative}.no:after{content:"✕";position:absolute;top:2mm;right:3mm;color:#F87171;font-size:14pt}
</style>
<div class="p" style="justify-content:center;align-items:center;background:url(${url(path.join(BRAND, "pulse-sphere-4k.jpg"))}) center/cover">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(5,4,15,.55),rgba(5,4,15,.9))"></div>
  <img src="${L("two-love-logo-stacked.svg")}" style="width:120mm;position:relative"><p style="position:relative;letter-spacing:.35em;font-size:10pt;color:#A5B4FC">BRAND GUIDELINES · MANUAL DE MARCA · 2026</p></div>
<div class="p"><h2>01 · CONCEPTO</h2><h1>PULSE SPHERE</h1>
  <div class="g" style="grid-template-columns:1.1fr 1fr;align-items:center;flex:1">
  <div style="display:flex;flex-direction:column;gap:5mm">
  <p><b>La esfera de partículas</b> representa a una comunidad global de personas verificadas: miles de puntos de luz que, juntos, forman un todo.</p>
  <p><b>El latido</b> atraviesa el núcleo: el pulso de una conexión real. No es una app de citas más; es donde el corazón se acelera.</p>
  <p><b>Las dos órbitas entrelazadas</b> son la pareja — <i>two</i> — dos trayectorias que se cruzan y giran en torno al mismo centro.</p>
  <p><b>Paleta neón</b> púrpura y azul eléctrico sobre el espacio profundo: tecnología, exclusividad y lujo contemporáneo, al estilo de las marcas fintech premium.</p></div>
  <div class="box" style="background:radial-gradient(circle,#1E1150,${COLORS.space} 70%)"><img src="${L("two-love-symbol.svg")}" style="width:110mm"></div></div><div class="n">TWO LOVE · 02</div></div>
<div class="p"><h2>02 · VERSIONES DEL LOGOTIPO</h2>
  <div class="g" style="grid-template-columns:1fr 1fr;flex:1">
  <div class="box" style="background:${COLORS.space};border:1px solid #1F1B3A;flex-direction:column;gap:3mm"><img src="${L("two-love-logo-horizontal.svg")}" style="width:110mm"><p>Principal · horizontal sobre fondo oscuro</p></div>
  <div class="box" style="background:#fff;flex-direction:column;gap:3mm"><img src="${L("two-love-logo-horizontal-light.svg")}" style="width:110mm"><p style="color:#444">Horizontal sobre fondo claro</p></div>
  <div class="box" style="background:${COLORS.space};border:1px solid #1F1B3A;flex-direction:column;gap:3mm"><img src="${L("two-love-logo-stacked-tagline-es.svg")}" style="height:52mm"><p>Vertical con claim</p></div>
  <div class="g" style="grid-template-columns:1fr 1fr">
   <div class="box" style="background:#6D28D9;flex-direction:column;gap:2mm"><img src="${L("two-love-logo-stacked-white.svg")}" style="width:42mm"><p>Monocromo blanco</p></div>
   <div class="box" style="background:#E5E7EB;flex-direction:column;gap:2mm"><img src="${L("two-love-logo-stacked-black.svg")}" style="width:42mm"><p style="color:#444">Monocromo negro</p></div></div></div><div class="n">TWO LOVE · 03</div></div>
<div class="p"><h2>03 · ÁREA DE RESPETO Y TAMAÑO MÍNIMO</h2>
  <div class="g" style="grid-template-columns:1.4fr 1fr;flex:1;align-items:center">
  <div class="box" style="background:${COLORS.space};border:1px dashed #6366F1;padding:14mm;position:relative"><img src="${L("two-love-logo-horizontal.svg")}" style="width:130mm;outline:1px solid rgba(99,102,241,.5);outline-offset:9mm"></div>
  <div style="display:flex;flex-direction:column;gap:5mm">
  <p><b>Área de respeto:</b> deja libre alrededor del logotipo un margen igual a la altura de la letra <b>O</b> de «TWO». Ningún texto, borde ni elemento gráfico debe invadirla.</p>
  <p><b>Tamaño mínimo:</b> horizontal 120 px (digital) / 30 mm (impreso); símbolo 24 px / 8 mm. Por debajo de 48 px usa el <b>icono simplificado</b> (orbe sólido).</p>
  <div style="display:flex;gap:6mm;align-items:end"><img src="${L("two-love-favicon.svg")}" style="width:16px"><img src="${L("two-love-favicon.svg")}" style="width:32px"><img src="${L("two-love-favicon.svg")}" style="width:48px"><img src="${L("two-love-app-icon.svg")}" style="width:22mm;border-radius:5mm"><img src="${L("two-love-app-icon.svg")}" style="width:22mm;border-radius:50%"></div>
  <p style="font-size:9pt;color:#9A9AC8">Favicon 16/32/48 px · icono de app y avatar de perfil (seguro en recorte circular).</p></div></div><div class="n">TWO LOVE · 04</div></div>
<div class="p"><h2>04 · COLOR</h2>
  <div class="g" style="grid-template-columns:repeat(5,1fr)">${swatch("Deep Space", COLORS.space, "Fondo principal")}${swatch("Night", COLORS.night, "Superficies")}${swatch("Electric Blue", COLORS.electric, "Acento · pulso")}${swatch("Indigo", COLORS.indigo, "Degradado")}${swatch("Violet", COLORS.violet, "Degradado · brillo")}${swatch("Neon Purple", COLORS.neon, "Acento")}${swatch("Magenta", COLORS.magenta, "Degradado final")}${swatch("Ivory", COLORS.ivory, "Texto")}</div>
  <div style="height:16mm;border-radius:5mm;background:linear-gradient(90deg,${COLORS.electric},${COLORS.indigo} 35%,#A855F7 70%,${COLORS.magenta})"></div>
  <p>Degradado de marca: Electric Blue → Indigo → Violet → Magenta, siempre en diagonal o horizontal y sobre fondos oscuros. En impresión, usar la versión monocroma o el logotipo claro.</p><div class="n">TWO LOVE · 05</div></div>
<div class="p"><h2>05 · TIPOGRAFÍA</h2>
  <div class="g" style="grid-template-columns:1fr 1fr;flex:1">
  <div style="display:flex;flex-direction:column;gap:4mm"><p style="color:#A5B4FC">Display · logotipo y titulares cortos</p><div style="font-family:S;font-size:34pt;letter-spacing:.14em">SYNCOPATE</div><div style="font-family:S;font-size:14pt;letter-spacing:.14em">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</div><p>Solo en mayúsculas, con espaciado amplio (+14–18%). Licencia SIL Open Font.</p></div>
  <div style="display:flex;flex-direction:column;gap:4mm"><p style="color:#A5B4FC">Texto · titulares, cuerpo e interfaz</p><div style="font-size:34pt;font-weight:600">Montserrat</div><div style="font-size:14pt">Regular 400 · <b style="font-weight:600">Semibold 600</b> · <b>Bold 700</b></div><p>Claims en Semibold con tracking ligeramente negativo; cuerpo en Regular. Licencia SIL Open Font.</p></div></div>
  <div class="glass" style="padding:8mm;border-radius:6mm;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)"><div style="font-size:26pt;font-weight:600">El amor también merece excelencia.</div><p>Citas verificadas de alto perfil · Dubái · Global</p></div><div class="n">TWO LOVE · 06</div></div>
<div class="p"><h2>06 · APLICACIONES · RRSS Y ANUNCIOS</h2>
  <div class="g" style="grid-template-columns:1.25fr .8fr .56fr;flex:1;align-items:start">
  <div style="display:flex;flex-direction:column;gap:5mm"><img src="${K("social/facebook-cover-1640x624.jpg")}" style="width:100%;border-radius:3mm"><img src="${K("ads/es/landscape-1200x628.jpg")}" style="width:100%;border-radius:3mm"></div>
  <img src="${K("ads/es/post-portrait-1080x1350.jpg")}" style="width:100%;border-radius:3mm"><img src="${K("ads/es/story-1080x1920.jpg")}" style="width:100%;border-radius:3mm"></div><div class="n">TWO LOVE · 07</div></div>
<div class="p"><h2>07 · USOS INCORRECTOS</h2>
  <div class="g" style="grid-template-columns:repeat(4,1fr);flex:1">
  <div class="box no" style="background:${COLORS.space}"><img src="${L("two-love-logo-stacked.svg")}" style="width:40mm;transform:scaleX(1.5)"></div>
  <div class="box no" style="background:${COLORS.space}"><img src="${L("two-love-logo-stacked.svg")}" style="width:40mm;filter:hue-rotate(140deg)"></div>
  <div class="box no" style="background:#F59E0B"><img src="${L("two-love-logo-stacked.svg")}" style="width:40mm"></div>
  <div class="box no" style="background:${COLORS.space}"><img src="${L("two-love-logo-stacked.svg")}" style="width:40mm;transform:rotate(-18deg)"></div></div>
  <ul style="display:grid;grid-template-columns:1fr 1fr;gap:2mm 10mm;padding-left:5mm"><li>No deformar ni cambiar proporciones.</li><li>No alterar los colores del degradado.</li><li>No usar la versión a color sobre fondos claros o saturados: usa la versión clara o monocroma.</li><li>No rotar, añadir sombras duras ni contornos.</li></ul><div class="n">TWO LOVE · 08</div></div>`;
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  fs.writeFileSync(TMP, guide);
  await page.goto(url(TMP));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.pdf({ path: path.join(OUT, "guide", "TWO-LOVE-brand-guidelines.pdf"), printBackground: true, preferCSSPageSize: true });
  await ctx.close();
}
fs.rmSync(TMP);
console.log("✓ Manual de marca PDF");
await browser.close();

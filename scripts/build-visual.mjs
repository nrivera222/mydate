// Genera public/brand/pulse-sphere.html: la animación "Pulse Sphere" en un único archivo HTML
// autónomo (sin dependencias ni red), a partir del mismo motor que usa la app.
// Uso: node scripts/build-visual.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { wordmarkTight, taglineOnly, TAGLINES } from "./build-logo.mjs";

const root = path.resolve(import.meta.dirname, "..");
const transpile = (file) =>
  ts
    .transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true } })
    .outputText.replace(/^export /gm, "");
const js = transpile("src/lib/pulse-sphere.ts");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TWO LOVE · Pulse Sphere</title>
<style>html,body{margin:0;height:100%;background:#020208;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style>
</head>
<body>
<canvas id="c" aria-hidden="true"></canvas>
<script>
${js}
// Parámetros: ?n=partículas  ?still=1 (fotograma fijo)  ?t=instante  ?x,?y=desplazamiento  ?s=escala
const q = new URLSearchParams(location.search);
window.pulseSphere = mountPulseSphere(document.getElementById("c"), {
  particles: Math.min(40000, Math.max(500, Number(q.get("n")) || 4800)),
  still: q.get("still") === "1",
  time: Number(q.get("t")) || 2.1,
  offsetX: Number(q.get("x")) || 0,
  offsetY: Number(q.get("y")) || 0,
  scale: Number(q.get("s")) || 1,
});
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, "public/brand"), { recursive: true });
fs.writeFileSync(path.join(root, "public/brand/pulse-sphere.html"), html);
// Motor suelto para componer piezas gráficas (scripts/build-brand-kit.mjs)
fs.writeFileSync(path.join(root, "public/brand/pulse-sphere.js"), js);
console.log("public/brand/pulse-sphere.html", (html.length / 1024).toFixed(1), "KB");

// ── Logotipo animado: public/brand/pulse-logo.html (+ motor suelto pulse-logo.js) ──
const logoJs = transpile("src/lib/pulse-logo.ts");
const uri = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
const logoHtml = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TWO LOVE · Logo</title>
<style>html,body{margin:0;height:100%;background:#05040F;overflow:hidden}html.transparent,html.transparent body{background:transparent}canvas{display:block;width:100vw;height:100vh}</style>
</head>
<body>
<canvas id="c" role="img" aria-label="TWO LOVE"></canvas>
<script>
${logoJs}
// Parámetros: ?layout=horizontal|stacked|symbol  ?tag=es|en (claim, vertical)  ?n=partículas
//             ?still=1&t=instante  ?transparent=1  ?intro=0  ?fill=0.8  ?x,?y=desplazamiento del símbolo
const WORDMARK = "${uri(wordmarkTight())}";
const TAGS = ${JSON.stringify(Object.fromEntries(Object.entries(TAGLINES).map(([k, v]) => [k, uri(taglineOnly(v))])))};
const q = new URLSearchParams(location.search);
const load = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
if (q.get("transparent") === "1") document.documentElement.classList.add("transparent");
Promise.all([load(WORDMARK), load(TAGS[q.get("tag")])]).then(([wordmark, tagline]) => {
  window.pulseLogo = mountPulseLogo(document.getElementById("c"), {
    layout: q.get("layout") || "horizontal",
    wordmark, tagline,
    particles: Math.min(20000, Math.max(300, Number(q.get("n")) || 2600)),
    transparent: q.get("transparent") === "1",
    intro: q.get("intro") !== "0",
    still: q.get("still") === "1",
    time: q.has("t") ? Number(q.get("t")) : INTRO + 0.1,
    fill: Number(q.get("fill")) || 0.8,
    offsetX: Number(q.get("x")) || 0,
    offsetY: Number(q.get("y")) || 0,
  });
});
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, "public/brand/pulse-logo.html"), logoHtml);
// Motor suelto para componer piezas (scripts/build-brand-kit.mjs)
fs.writeFileSync(path.join(root, "public/brand/pulse-logo.js"), logoJs);
console.log("public/brand/pulse-logo.html", (logoHtml.length / 1024).toFixed(1), "KB");

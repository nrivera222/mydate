// Genera public/brand/pulse-sphere.html: la animación "Pulse Sphere" en un único archivo HTML
// autónomo (sin dependencias ni red), a partir del mismo motor que usa la app.
// Uso: node scripts/build-visual.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(root, "src/lib/pulse-sphere.ts"), "utf8");
const js = ts
  .transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true } })
  .outputText.replace(/^export /gm, "");

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
// Parámetros: ?n=partículas  ?still=1 (fotograma fijo)  ?t=instante
const q = new URLSearchParams(location.search);
window.pulseSphere = mountPulseSphere(document.getElementById("c"), {
  particles: Math.min(40000, Math.max(500, Number(q.get("n")) || 4800)),
  still: q.get("still") === "1",
  time: Number(q.get("t")) || 2.1,
});
</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, "public/brand"), { recursive: true });
fs.writeFileSync(path.join(root, "public/brand/pulse-sphere.html"), html);
console.log("public/brand/pulse-sphere.html", (html.length / 1024).toFixed(1), "KB");

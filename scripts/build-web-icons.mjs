// Iconos y tarjeta social de la web renderizados con el efecto Pulse Sphere (se versionan).
// Requisitos: Playwright (o CHROMIUM=/ruta/a/chrome). Antes: node scripts/build-visual.mjs
// Uso: node scripts/build-web-icons.mjs
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const page = `file://${path.join(root, "public/brand/pulse-logo.html")}`;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
fs.mkdirSync(path.join(root, "public/brand/icons"), { recursive: true });

async function render(file, w, h, query, scale = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  await p.goto(`${page}?still=1&t=5&${new URLSearchParams(query)}`);
  await p.waitForFunction(() => document.getElementById("c")?.dataset.ready === "1");
  const jpg = file.endsWith(".jpg");
  await p.screenshot({ path: path.join(root, file), type: jpg ? "jpeg" : "png", quality: jpg ? 88 : undefined });
  await ctx.close();
  console.log(file, (fs.statSync(path.join(root, file)).size / 1024).toFixed(0), "KB");
}

// Icono de app: símbolo sobre fondo espacial (seguro en recorte circular y máscara adaptable)
await render("src/app/apple-icon.png", 180, 180, { layout: "symbol", fill: 0.92, n: 1400 });
await render("public/brand/icons/icon-192.png", 192, 192, { layout: "symbol", fill: 0.92, n: 1400 });
await render("public/brand/icons/icon-512.png", 512, 512, { layout: "symbol", fill: 0.92, n: 3000 });
await render("public/brand/icons/icon-maskable-512.png", 512, 512, { layout: "symbol", fill: 0.7, n: 3000 });
// Tarjeta para compartir enlaces (Open Graph / X)
await render("src/app/opengraph-image.jpg", 1200, 630, { layout: "horizontal", fill: 0.74, n: 3600 });
await browser.close();

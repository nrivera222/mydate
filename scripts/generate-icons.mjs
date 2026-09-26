// Genera el favicon (src/app/icon.svg) a partir de la geometría del logotipo.
// Uso: node --experimental-strip-types scripts/generate-icons.mjs
import fs from "node:fs";
import path from "node:path";

const { logoSvg } = await import(path.join(import.meta.dirname, "../src/lib/logo.ts"));
fs.writeFileSync(path.join(import.meta.dirname, "../src/app/icon.svg"), logoSvg(64));
fs.mkdirSync(path.join(import.meta.dirname, "../public/brand"), { recursive: true });
fs.writeFileSync(path.join(import.meta.dirname, "../public/brand/two-love-mark.svg"), logoSvg(512));
fs.writeFileSync(path.join(import.meta.dirname, "../public/brand/two-love-mark-transparent.svg"), logoSvg(512, false));
console.log("Iconos generados.");

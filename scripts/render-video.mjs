// Renderiza la animación "Pulse Sphere" a MP4 (H.264) fotograma a fotograma.
// Requisitos: `npm i -D playwright` y ffmpeg (variable FFMPEG o en el PATH). Antes: node scripts/build-visual.mjs
// Uso: node scripts/render-video.mjs salida.mp4 1920 1080 12 9000   (ancho alto segundos partículas)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
const [,, name, W, H, secs, n] = process.argv;
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const fps = 30, frames = Math.round(Number(secs) * fps);
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: Number(W), height: Number(H) } });
await p.goto(`file://${path.resolve(import.meta.dirname, "../public/brand/pulse-sphere.html")}?still=1&n=${n}`);
await p.waitForFunction(() => window.pulseSphere);
const ff = spawn(FFMPEG, ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", name], { stdio: ["pipe", "ignore", "inherit"] });
for (let i = 0; i < frames; i++) {
  const t = 2.1 + i / fps;
  const data = await p.evaluate((t) => { window.pulseSphere.draw(t); return document.getElementById("c").toDataURL("image/jpeg", 0.95).split(",")[1]; }, t);
  if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 60 === 0) process.stdout.write(`${i}/${frames} `);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await b.close();
console.log("\n", name, (fs.statSync(name).size / 1e6).toFixed(1), "MB");

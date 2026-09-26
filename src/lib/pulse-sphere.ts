// Motor de la esfera de energía "Pulse Sphere" (canvas 2D, sin dependencias).
// Lo usan el componente React, la página /visual, el HTML independiente y el render de vídeo.

export type PulseSphereOptions = {
  /** Número de partículas de la esfera (se reduce automáticamente en móviles si no es `still`). */
  particles?: number;
  /** Render estático (sin bucle de animación ni interacción). */
  still?: boolean;
  /** Instante de la animación a representar cuando `still` está activo. */
  time?: number;
  /** Desplazamiento horizontal/vertical del centro, en fracción del lienzo (-0.5…0.5). */
  offsetX?: number;
  offsetY?: number;
  /** Escala del radio de la esfera (1 = 34% del lado menor). */
  scale?: number;
};

export type PulseSphereHandle = { draw: (t: number) => void; resize: () => void; destroy: () => void };

const PALETTE = [
  [56, 189, 248], // azul eléctrico
  [59, 130, 246], // azul
  [99, 102, 241], // índigo
  [139, 92, 246], // violeta
  [192, 38, 211], // púrpura neón
  [232, 121, 249], // magenta claro
];

function sprite(rgb: number[], size = 64, core = 0.18) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(core, `rgba(${rgb.join(",")},0.95)`);
  grd.addColorStop(0.45, `rgba(${rgb.join(",")},0.25)`);
  grd.addColorStop(1, `rgba(${rgb.join(",")},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

// Pseudoaleatorio determinista: la escena es idéntica en cada carga
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Latido: dos impulsos por ciclo (lub-dub). */
function beat(t: number) {
  const p = (t % 1.25) / 1.25;
  return Math.exp(-(((p - 0.08) / 0.045) ** 2)) + 0.6 * Math.exp(-(((p - 0.26) / 0.05) ** 2));
}

export function mountPulseSphere(canvas: HTMLCanvasElement, { particles = 3600, still = false, time = 2.1, offsetX = 0, offsetY = 0, scale = 1 }: PulseSphereOptions = {}): PulseSphereHandle {
  const ctx = canvas.getContext("2d")!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const N = still ? particles : Math.round(mobile ? particles * 0.4 : particles);
  const rand = rng(20260925);
  const sprites = PALETTE.map((c) => sprite(c));
  const white = sprite([230, 240, 255], 64, 0.35);

  // Partículas de la superficie (distribución de Fibonacci con ruido)
  const golden = Math.PI * (3 - Math.sqrt(5));
  const shell = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const jitter = 1 + (rand() - 0.5) * 0.06 + (rand() < 0.08 ? rand() * 0.25 : 0);
    return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, j: jitter, tw: rand() * Math.PI * 2, s: 0.5 + rand() * 0.9 };
  });
  // Núcleo de plasma
  const core = Array.from({ length: Math.round(N * 0.09) }, () => {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, rr = Math.cbrt(rand()) * 0.42;
    const r = Math.sqrt(1 - u * u);
    return { x: Math.cos(a) * r * rr, y: u * rr, z: Math.sin(a) * r * rr, tw: rand() * 6.28 };
  });
  // Filamentos de luz en órbita
  const strands = Array.from({ length: 14 }, (_, k) => ({
    radius: 1.12 + rand() * 0.95,
    tiltX: (rand() - 0.5) * 2.4,
    tiltZ: (rand() - 0.5) * 2.4,
    speed: (0.25 + rand() * 0.35) * (k % 2 ? -1 : 1),
    phase: rand() * Math.PI * 2,
    length: 1.6 + rand() * 2.4,
    hue: PALETTE[(k * 2) % PALETTE.length],
    wobble: rand() * 0.12,
  }));
  const stars = Array.from({ length: 260 }, () => ({ x: rand(), y: rand(), s: rand() * 1.2 + 0.2, tw: rand() * 6.28 }));
  const dust = Array.from({ length: 180 }, () => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1, s: rand() }));

  let w = 0, h = 0, dpr = 1, raf = 0, visible = true;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  const resize = () => {
    dpr = still ? window.devicePixelRatio || 1 : Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const draw = (t: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    // Fondo cósmico
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    bg.addColorStop(0, "#0d0a1f");
    bg.addColorStop(0.55, "#060512");
    bg.addColorStop(1, "#020208");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 0.8 + s.tw) ** 2;
      ctx.fillStyle = "#c7d2fe";
      ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
    }

    const R = Math.min(w, h) * 0.34 * scale;
    const cx = w * (0.5 + offsetX) + mouse.x * 18, cy = h * (0.5 + offsetY) + mouse.y * 12;
    const b = beat(t);
    const pulse = 1 + 0.035 * b;

    // Niebla volumétrica
    const fogs: [number, number, number, number[], number][] = [
      [cx + Math.sin(t * 0.15) * R * 0.6, cy + Math.cos(t * 0.11) * R * 0.3, R * 2.4, [124, 58, 237], 0.18],
      [cx - Math.cos(t * 0.13) * R * 0.7, cy + Math.sin(t * 0.17) * R * 0.4, R * 2.0, [37, 99, 235], 0.16],
      [cx, cy, R * 1.5, [192, 38, 211], 0.1 + 0.08 * b],
    ];
    for (const [fx, fy, fr, c, a] of fogs) {
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      g.addColorStop(0, `rgba(${c.join(",")},${a})`);
      g.addColorStop(1, `rgba(${c.join(",")},0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Rotación 3D
    const ay = t * 0.18 + mouse.x * 0.4, ax = 0.35 + mouse.y * 0.3;
    const cyr = Math.cos(ay), syr = Math.sin(ay), cxr = Math.cos(ax), sxr = Math.sin(ax);
    const cam = 3.4, focus = 2.9;
    const project = (x: number, y: number, z: number) => {
      const x1 = x * cyr + z * syr, z1 = -x * syr + z * cyr;
      const y2 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr;
      const k = focus / (cam + z2);
      return { sx: cx + x1 * k * R, sy: cy + y2 * k * R, z: z2, k };
    };

    // Halo del núcleo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
    halo.addColorStop(0, `rgba(224,231,255,${0.55 + 0.35 * b})`);
    halo.addColorStop(0.18, `rgba(167,139,250,${0.35 + 0.2 * b})`);
    halo.addColorStop(0.5, "rgba(76,29,149,0.12)");
    halo.addColorStop(1, "rgba(30,27,75,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Onda de pulso que recorre la esfera de polo a polo
    const wave = ((t * 0.55) % 1.6) - 0.3;

    for (const p of core) {
      const pr = project(p.x * pulse * 1.1, p.y * pulse * 1.1, p.z * pulse * 1.1);
      const size = 7 * pr.k;
      ctx.globalAlpha = 0.12 + 0.18 * Math.sin(t * 3 + p.tw) ** 2;
      ctx.drawImage(sprites[3 + (Math.floor(p.tw * 10) % 3)], pr.sx - size, pr.sy - size, size * 2, size * 2);
    }

    for (const p of shell) {
      const lat = (p.y + 1) / 2;
      const d = lat - wave;
      const bump = Math.exp(-(d * d) / 0.0022);
      const rr = p.j * pulse * (1 + 0.1 * bump);
      const pr = project(p.x * rr, p.y * rr, p.z * rr);
      const blur = Math.abs(pr.z) * 1.6; // profundidad de campo
      const size = (1.6 + p.s * 1.6 + blur * 3.2 + bump * 3) * pr.k;
      const front = pr.z < 0 ? 1 : 0.45;
      ctx.globalAlpha = Math.min(1, (0.25 + 0.55 * Math.sin(t * 1.7 + p.tw) ** 2 + bump * 0.8) * front / (1 + blur * 1.2));
      const hue = Math.min(PALETTE.length - 1, Math.max(0, Math.floor(((p.x + 1) / 2 * 0.6 + lat * 0.4) * PALETTE.length)));
      ctx.drawImage(bump > 0.85 ? white : bump > 0.35 ? sprites[0] : sprites[hue], pr.sx - size, pr.sy - size, size * 2, size * 2);
    }

    // Filamentos en órbita: estela continua en tramos con degradado de opacidad y un pase de resplandor
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    for (const s of strands) {
      const segs = 160;
      const head = t * s.speed + s.phase;
      const ctz = Math.cos(s.tiltZ), stz = Math.sin(s.tiltZ), ctx2 = Math.cos(s.tiltX), stx = Math.sin(s.tiltX);
      const pts: ReturnType<typeof project>[] = [];
      for (let i = 0; i <= segs; i++) {
        const f = i / segs;
        const a = head - f * s.length * Math.sign(s.speed);
        const rad = s.radius * (1 + s.wobble * Math.sin(a * 3 + t)) * pulse;
        let x = Math.cos(a) * rad, y = 0, z = Math.sin(a) * rad;
        const y1 = y * ctx2 - z * stx; z = y * stx + z * ctx2; y = y1;
        const x1 = x * ctz - y * stz; y = x * stz + y * ctz; x = x1;
        pts.push(project(x, y, z));
      }
      const chunk = 8;
      for (const pass of [0, 1]) {
        for (let i = 0; i < segs; i += chunk) {
          const f = i / segs;
          const pr = pts[i];
          const depth = pr.z < 0 ? 1 : 0.4;
          ctx.globalAlpha = (1 - f) ** 1.8 * depth * (pass ? 0.9 : 0.18);
          ctx.strokeStyle = pass ? `rgb(${s.hue.join(",")})` : `rgb(${s.hue.map((c) => Math.min(255, c + 40)).join(",")})`;
          ctx.lineWidth = (pass ? 2.2 * (1 - f) + 0.5 : 10 * (1 - f) + 2) * pr.k;
          ctx.beginPath();
          ctx.moveTo(pts[i].sx, pts[i].sy);
          for (let j = i + 1; j <= Math.min(segs, i + chunk); j++) ctx.lineTo(pts[j].sx, pts[j].sy);
          ctx.stroke();
        }
      }
      const hp = pts[0];
      const size = 16 * hp.k;
      ctx.globalAlpha = hp.z < 0 ? 1 : 0.5;
      ctx.drawImage(white, hp.sx - size, hp.sy - size, size * 2, size * 2);
    }

    // Polvo luminoso cercano a cámara (bokeh)
    for (const d of dust) {
      const pr = project(d.x * 2.2, d.y * 1.6, d.z * 2.2);
      if (pr.z > 1.2 || pr.k <= 0) continue;
      const size = (6 + d.s * 14) * pr.k * (pr.z < -0.8 ? 2.2 : 1);
      ctx.globalAlpha = 0.06 + d.s * 0.08;
      ctx.drawImage(sprites[(Math.floor(d.s * 10) % PALETTE.length)], pr.sx - size, pr.sy - size, size * 2, size * 2);
    }

    // Viñeta cinematográfica
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  };

  resize();
  const start = performance.now();
  const loop = (now: number) => {
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    if (visible) draw((now - start) / 1000 + time);
    raf = requestAnimationFrame(loop);
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  const ro = new ResizeObserver(() => {
    resize();
    if (still || reduced) draw(time);
  });
  io.observe(canvas);
  ro.observe(canvas);

  if (still || reduced) {
    draw(time);
    canvas.dataset.ready = "1";
  } else {
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
  }
  const destroy = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    io.disconnect();
    ro.disconnect();
  };
  return { draw, resize, destroy };
}

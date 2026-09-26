const LOOP = 10;
const INTRO = 2.6;
const PALETTE = [
    [56, 189, 248], [59, 130, 246], [99, 102, 241], [139, 92, 246], [168, 85, 247], [192, 38, 211], [232, 121, 249],
];
const RING_COLORS = [[[56, 189, 248], [59, 130, 246]], [[168, 85, 247], [232, 121, 249]]];
function sprite(rgb, size = 64, core = 0.18) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(core, `rgba(${rgb.join(",")},0.95)`);
    grd.addColorStop(0.45, `rgba(${rgb.join(",")},0.25)`);
    grd.addColorStop(1, `rgba(${rgb.join(",")},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
}
function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const TAU = Math.PI * 2;
const gauss = (u, mu, s) => Math.exp(-((u - mu) ** 2) / (2 * s * s));
const heartbeat = (u) => 0.16 * gauss(u, -0.42, 0.07) - 0.22 * gauss(u, -0.09, 0.03) + gauss(u, 0, 0.035) - 0.5 * gauss(u, 0.09, 0.035) + 0.26 * gauss(u, 0.4, 0.09);
const beat = (t) => {
    const p = (((t % 1.25) + 1.25) % 1.25) / 1.25;
    return Math.exp(-(((p - 0.08) / 0.045) ** 2)) + 0.6 * Math.exp(-(((p - 0.26) / 0.05) ** 2));
};
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
function mountPulseLogo(canvas, opts = {}) {
    const { layout = "horizontal", wordmark = null, tagline = null, particles = 2600, transparent = false, intro = true, still = false, time = 0, fill = 0.8, offsetX = 0, offsetY = 0 } = opts;
    const ctx = canvas.getContext("2d");
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rand = rng(20260926);
    const sprites = PALETTE.map((c) => sprite(c));
    const white = sprite([230, 240, 255], 64, 0.35);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const shell = Array.from({ length: particles }, (_, i) => {
        const y = 1 - (i / (particles - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
        const a = rand() * TAU, e = Math.acos(rand() * 2 - 1), d = 2.6 + rand() * 3.5;
        return {
            x: Math.cos(th) * r, y, z: Math.sin(th) * r,
            j: 1 + (rand() - 0.5) * 0.05,
            f: 1 + Math.floor(rand() * 3), ph: rand() * TAU, s: 0.55 + rand() * 0.9,
            ox: Math.cos(a) * Math.sin(e) * d, oy: Math.cos(e) * d, oz: Math.sin(a) * Math.sin(e) * d,
            delay: rand() * 0.35,
        };
    });
    const core = Array.from({ length: Math.round(particles * 0.1) }, () => {
        const u = rand() * 2 - 1, a = rand() * TAU, rr = Math.cbrt(rand()) * 0.45, r = Math.sqrt(1 - u * u);
        return { x: Math.cos(a) * r * rr, y: u * rr, z: Math.sin(a) * r * rr, ph: rand() * TAU, f: 1 + Math.floor(rand() * 4) };
    });
    const stars = Array.from({ length: 220 }, () => ({ x: rand(), y: rand(), s: rand() * 1.2 + 0.2, ph: rand() * TAU, f: 1 + Math.floor(rand() * 2) }));
    const dust = Array.from({ length: 90 }, () => ({ a: rand() * TAU, r: 1.5 + rand() * 1.6, y: (rand() - 0.5) * 1.6, s: rand(), f: rand() < 0.5 ? 1 : -1 }));
    const rings = [
        { tilt: (-32 * Math.PI) / 180, rx: 1.3, ry: 0.36, a0: Math.PI - 0.55, dir: 1 },
        { tilt: (32 * Math.PI) / 180, rx: 1.3, ry: 0.36, a0: 0.55, dir: -1 },
    ];
    let w = 0, h = 0, dpr = 1, raf = 0;
    const resize = () => {
        dpr = still ? window.devicePixelRatio || 1 : Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    };
    const layoutBoxes = () => {
        const l = layoutRaw(), dx = offsetX * w, dy = offsetY * h;
        const mv = (r) => (r ? { ...r, x: r.x + dx, y: r.y + dy } : null);
        return { cx: l.cx + dx, cy: l.cy + dy, R: l.R, wm: mv(l.wm), tg: mv(l.tg) };
    };
    const layoutRaw = () => {
        const wmRatio = wordmark ? wordmark.naturalWidth / wordmark.naturalHeight || 8.4 : 8.4;
        const tgRatio = tagline ? tagline.naturalWidth / tagline.naturalHeight || 20 : 20;
        if (layout === "symbol" || !wordmark) {
            const box = Math.min(w, h) * fill;
            return { cx: w / 2, cy: h / 2, R: box / 2.9, wm: null, tg: null };
        }
        if (layout === "horizontal") {
            const unitW = 1 + 0.12 + 0.17 * wmRatio, unitH = 1;
            const B = Math.min((w * fill) / unitW, (h * fill) / unitH);
            const x0 = (w - B * unitW) / 2;
            return { cx: x0 + B / 2, cy: h / 2, R: B / 2.9, wm: { x: x0 + B * 1.12, y: h / 2 - B * 0.085, w: B * 0.17 * wmRatio, h: B * 0.17 }, tg: null };
        }
        const wmW = 1.15, wmH = wmW / wmRatio, tgW = tagline ? 0.95 : 0, tgH = tagline ? tgW / tgRatio : 0;
        const unitH = 1 + 0.08 + wmH + (tagline ? 0.07 + tgH : 0), unitW = Math.max(1, wmW);
        const B = Math.min((w * fill) / unitW, (h * fill) / unitH);
        const y0 = (h - B * unitH) / 2;
        const wmY = y0 + B * 1.08;
        return {
            cx: w / 2, cy: y0 + B / 2, R: B / 2.9,
            wm: { x: w / 2 - (B * wmW) / 2, y: wmY, w: B * wmW, h: B * wmH },
            tg: tagline ? { x: w / 2 - (B * tgW) / 2, y: wmY + B * (wmH + 0.07), w: B * tgW, h: B * tgH } : null,
        };
    };
    const draw = (tRaw) => {
        const t = intro ? tRaw - INTRO : tRaw;
        const lt = ((t % LOOP) + LOOP) % LOOP;
        const pIntro = intro ? clamp01(tRaw / INTRO) : 1;
        const { cx, cy, R, wm, tg } = layoutBoxes();
        const S = R / 150;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, w, h);
        if (!transparent) {
            const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
            bg.addColorStop(0, "#0d0a1f");
            bg.addColorStop(0.55, "#060512");
            bg.addColorStop(1, "#020208");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = "lighter";
        if (!transparent) {
            for (const s of stars) {
                ctx.globalAlpha = (0.2 + 0.3 * Math.sin((TAU * s.f * lt) / LOOP + s.ph) ** 2) * pIntro;
                ctx.fillStyle = "#c7d2fe";
                ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
            }
            const fogs = [
                [cx + Math.sin((TAU * lt) / LOOP) * R * 0.5, cy + Math.cos((TAU * lt) / LOOP) * R * 0.25, R * 3, [124, 58, 237], 0.2],
                [cx - Math.cos((TAU * lt) / LOOP) * R * 0.6, cy + Math.sin((TAU * lt) / LOOP) * R * 0.3, R * 2.6, [37, 99, 235], 0.16],
            ];
            for (const [fx, fy, fr, c, a] of fogs) {
                const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
                g.addColorStop(0, `rgba(${c.join(",")},${a * pIntro})`);
                g.addColorStop(1, `rgba(${c.join(",")},0)`);
                ctx.globalAlpha = 1;
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
        }
        const b = t < 0 ? 0 : beat(lt);
        const pulse = 1 + 0.03 * b;
        const ay = 0.6 + 0.35 * Math.sin((TAU * lt) / LOOP) + (1 - ease(pIntro)) * 1.6;
        const ax = 0.42 + 0.06 * Math.sin((TAU * 2 * lt) / LOOP);
        const cyr = Math.cos(ay), syr = Math.sin(ay), cxr = Math.cos(ax), sxr = Math.sin(ax);
        const rot = (x, y, z) => {
            const x1 = x * cyr + z * syr, z1 = -x * syr + z * cyr;
            return [x1, y * cxr - z1 * sxr, y * sxr + z1 * cxr];
        };
        const cam = 4.2, focal = 3.6;
        const proj = (x, y, z) => {
            const k = focal / (cam + z);
            return { sx: cx + x * k * R * 1.12, sy: cy + y * k * R * 1.12, z, k };
        };
        const haloA = ease((pIntro - 0.3) / 0.7);
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
        halo.addColorStop(0, `rgba(224,231,255,${(0.5 + 0.35 * b) * haloA})`);
        halo.addColorStop(0.2, `rgba(167,139,250,${(0.35 + 0.2 * b) * haloA})`);
        halo.addColorStop(0.55, `rgba(76,29,149,${0.14 * haloA})`);
        halo.addColorStop(1, "rgba(30,27,75,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.25, 0, TAU);
        ctx.fill();
        const ringPt = (r, a) => {
            const x = Math.cos(a) * r.rx * R * pulse, y = Math.sin(a) * r.ry * R * pulse;
            return { x: cx + x * Math.cos(r.tilt) - y * Math.sin(r.tilt), y: cy + x * Math.sin(r.tilt) + y * Math.cos(r.tilt) };
        };
        const ringDraw = ringA(pIntro);
        const drawRing = (i, front) => {
            const r = rings[i];
            const [c0, c1] = RING_COLORS[i];
            const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
            const segs = 90;
            for (const pass of front ? [0, 1, 2] : [2]) {
                ctx.lineCap = "round";
                for (let k = 0; k < segs; k++) {
                    const f0 = k / segs;
                    if ((front ? f0 : 1 - f0) > ringDraw)
                        continue;
                    const p0 = ringPt(r, a0 + (a1 - a0) * f0), p1 = ringPt(r, a0 + (a1 - a0) * ((k + 1) / segs));
                    const col = mix(c0, c1, f0);
                    ctx.strokeStyle = `rgb(${col.join(",")})`;
                    ctx.globalAlpha = front ? [0.12, 0.35, 1][pass] : 0.32;
                    ctx.lineWidth = (front ? [16, 7, 2.6][pass] : 1.6) * S;
                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
            }
        };
        const drawComet = (i, frontPass) => {
            if (pIntro < 1)
                return;
            const r = rings[i];
            const head = r.a0 + (r.dir * TAU * lt) / LOOP;
            const inFront = (((head % TAU) + TAU) % TAU) < Math.PI;
            if (inFront !== frontPass)
                return;
            const [c0, c1] = RING_COLORS[i];
            for (let k = 0; k < 40; k++) {
                const f0 = k / 40;
                const p0 = ringPt(r, head - r.dir * f0 * 1.4), p1 = ringPt(r, head - r.dir * (f0 + 1 / 40) * 1.4);
                ctx.globalAlpha = (1 - f0) ** 2 * (inFront ? 0.9 : 0.35);
                ctx.strokeStyle = `rgb(${mix(c1, c0, f0).join(",")})`;
                ctx.lineWidth = (4.5 * (1 - f0) + 1) * S;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            }
            const hp = ringPt(r, head);
            const size = (inFront ? 30 : 18) * S;
            ctx.globalAlpha = inFront ? 1 : 0.45;
            ctx.drawImage(white, hp.x - size, hp.y - size, size * 2, size * 2);
        };
        drawRing(0, false);
        drawRing(1, false);
        drawComet(0, false);
        drawComet(1, false);
        for (const p of core) {
            const [x, y, z] = rot(p.x * pulse, p.y * pulse, p.z * pulse);
            const pr = proj(x, y, z);
            const size = 8 * S * pr.k;
            ctx.globalAlpha = (0.1 + 0.2 * Math.sin((TAU * p.f * lt) / LOOP + p.ph) ** 2) * haloA;
            ctx.drawImage(sprites[4 + (p.f % 3)], pr.sx - size, pr.sy - size, size * 2, size * 2);
        }
        for (const p of shell) {
            const e = ease((pIntro - p.delay) / (1 - 0.35));
            const rr = p.j * pulse;
            const [x, y, z] = rot(p.ox + (p.x * rr - p.ox) * e, p.oy + (p.y * rr - p.oy) * e, p.oz + (p.z * rr - p.oz) * e);
            const pr = proj(x, y, z);
            const depth = (1 - clamp01((z + 1) / 2));
            const blur = Math.abs(z) * 0.9 + (1 - e) * 2.5;
            const size = (1.5 + p.s * 1.4 + blur * 2.4) * S * pr.k;
            const tw = 0.35 + 0.65 * Math.sin((TAU * p.f * lt) / LOOP + p.ph) ** 2;
            ctx.globalAlpha = Math.min(1, (0.25 + 0.75 * depth) * tw / (1 + blur * 0.9)) * (0.3 + 0.7 * e);
            const diag = clamp01((((pr.sx - cx) + (pr.sy - cy)) / (R * 2.4)) + 0.5);
            ctx.drawImage(sprites[Math.min(PALETTE.length - 1, Math.floor(diag * PALETTE.length))], pr.sx - size, pr.sy - size, size * 2, size * 2);
        }
        const ecgA = ease((pIntro - 0.55) / 0.45);
        if (ecgA > 0) {
            const N = 180;
            const pts = Array.from({ length: N + 1 }, (_, k) => {
                const u = -1 + (2 * k) / N;
                return { u, x: cx + u * R * 0.78, y: cy - heartbeat(u) * R * 0.56 };
            });
            const reveal = ecgA;
            const sweep = t < 0 ? -2 : -1 + 2 * ((((lt / 1.25 - 0.08 + 0.5) % 1) + 1) % 1);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (let k = 0; k < N; k++) {
                const p0 = pts[k], p1 = pts[k + 1];
                if ((p0.u + 1) / 2 > reveal)
                    break;
                const edge = 1 - Math.abs(p0.u) ** 3;
                const col = p0.u < 0 ? mix(PALETTE[0], [255, 255, 255], 1 + p0.u) : mix([255, 255, 255], PALETTE[6], p0.u);
                const d = sweep - p0.u;
                const glow = d >= 0 && d < 0.9 ? (1 - d / 0.9) ** 2 : 0;
                for (const [wid, al] of [[13, 0.08 + 0.22 * glow], [5, 0.28 + 0.4 * glow], [1.9, 0.75 + 0.25 * glow]]) {
                    ctx.globalAlpha = al * edge * ecgA;
                    ctx.strokeStyle = `rgb(${col.join(",")})`;
                    ctx.lineWidth = wid * S * (1 + glow * 0.4);
                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
            }
            if (sweep >= -1 && sweep <= 1) {
                const hk = Math.round(((sweep + 1) / 2) * N);
                const hp = pts[Math.max(0, Math.min(N, hk))];
                const size = 22 * S;
                ctx.globalAlpha = 0.9 * (1 - Math.abs(sweep) ** 3) * ecgA;
                ctx.drawImage(white, hp.x - size, hp.y - size, size * 2, size * 2);
            }
        }
        drawRing(0, true);
        drawRing(1, true);
        drawComet(0, true);
        drawComet(1, true);
        for (const d of transparent ? [] : dust) {
            const a = d.a + (d.f * TAU * lt) / LOOP;
            const [x, y, z] = rot(Math.cos(a) * d.r, d.y, Math.sin(a) * d.r);
            const pr = proj(x, y, z);
            const size = (5 + d.s * 12) * S * pr.k;
            ctx.globalAlpha = (0.05 + d.s * 0.08) * pIntro;
            ctx.drawImage(sprites[Math.floor(d.s * 10) % PALETTE.length], pr.sx - size, pr.sy - size, size * 2, size * 2);
        }
        ctx.globalCompositeOperation = "source-over";
        const wmA = ease((pIntro - 0.7) / 0.3);
        if (wm && wordmark && wmA > 0) {
            const dx = (1 - wmA) * wm.h * 0.8 * (layout === "horizontal" ? 1 : 0), dy = layout === "stacked" ? (1 - wmA) * wm.h * 0.6 : 0;
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = (0.12 + 0.08 * b) * wmA;
            ctx.filter = `blur(${Math.max(2, wm.h * 0.18)}px)`;
            ctx.drawImage(wordmark, wm.x + dx, wm.y + dy, wm.w, wm.h);
            ctx.filter = "none";
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = wmA;
            ctx.drawImage(wordmark, wm.x + dx, wm.y + dy, wm.w, wm.h);
            if (tg && tagline) {
                ctx.globalAlpha = ease((pIntro - 0.85) / 0.15) * 0.9;
                ctx.drawImage(tagline, tg.x, tg.y + dy, tg.w, tg.h);
            }
        }
        ctx.globalAlpha = 1;
    };
    resize();
    const ro = new ResizeObserver(() => {
        resize();
        if (still || reduced)
            draw(still ? time : INTRO + 0.4);
    });
    ro.observe(canvas);
    if (still || reduced) {
        draw(still ? time : INTRO + 0.4);
        canvas.dataset.ready = "1";
    }
    else {
        const start = performance.now();
        const loop = (now) => {
            draw((now - start) / 1000 + (intro ? 0 : time));
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
    }
    return {
        draw,
        resize,
        destroy: () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        },
    };
}
function ringA(p) {
    return ease((p - 0.25) / 0.55);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * Lector de QR con la cámara (BarcodeDetector del navegador). Al leer un código abre la reserva
 * en el escáner. Si el navegador no lo soporta, se usa el campo de texto de la página.
 */
export function QrScanner({ labels }: { labels: { start: string; stop: string; unsupported: string; denied: string } }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, raf = 0, stopped = false;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      stream = s;
      if (!video.current || stopped) return;
      video.current.srcObject = s;
      void video.current.play();
      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          const hit = codes.find((c) => /^TLP-[\w-]+$/.test(c.rawValue));
          if (hit) {
            setOn(false);
            router.push(`/admin/park/escaner?qr=${encodeURIComponent(hit.rawValue)}`);
            return;
          }
        } catch { /* fotograma no disponible todavía */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => { setMsg(labels.denied); setOn(false); });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, router, labels.denied]);

  if (!supported) return <p className="text-sm text-muted">{labels.unsupported}</p>;
  return (
    <div className="space-y-3">
      {on && <video ref={video} className="aspect-square w-full max-w-sm rounded-2xl border border-brand/50 object-cover" muted playsInline />}
      <button type="button" className={on ? "btn-ghost" : "btn-brand"} onClick={() => { setMsg(""); setOn(!on); }}>{on ? labels.stop : labels.start}</button>
      {msg && <p className="text-sm text-rose">{msg}</p>}
    </div>
  );
}

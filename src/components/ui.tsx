import Link from "next/link";
import { tierById, VERIFICATION_TYPES } from "@/lib/catalog";
import { currentLocale, tr, translateMessage } from "@/lib/i18n";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div role="status" className={`mb-6 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose/40 bg-rose/10 text-rose" : "border-ok/40 bg-ok/10 text-ok"}`}>
      {translateMessage(currentLocale(), (error ?? ok)!)}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Avatar({ name, hue, photo, size = 56, blur = false }: { name: string; hue: number; photo?: string | null; size?: number; blur?: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const style = { width: size, height: size };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/media/${photo}`} alt={name} style={style} className={`shrink-0 rounded-full object-cover ${blur ? "blur-md" : ""}`} />;
  }
  return (
    <div
      aria-hidden
      style={{ ...style, background: `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 55% 18%))`, fontSize: size * 0.36 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-display text-ivory ring-1 ring-gold/30 ${blur ? "blur-sm" : ""}`}
    >
      {initials}
    </div>
  );
}

export function Portrait({ name, hue, photo, className = "" }: { name: string; hue: number; photo?: string | null; className?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/media/${photo}`} alt={name} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div
      style={{ background: `radial-gradient(circle at 30% 20%, hsl(${hue} 50% 40%), hsl(${(hue + 50) % 360} 45% 12%) 70%)` }}
      className={`flex h-full w-full items-center justify-center font-display text-6xl text-ivory/90 ${className}`}
    >
      {initials}
    </div>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const t = tierById(tier);
  const styles: Record<string, string> = {
    essential: "border-line text-muted",
    gold: "border-gold/50 text-gold-2",
    platinum: "border-slate-300/50 text-slate-200",
    diamond: "border-sky-300/50 text-sky-200",
    royal: "border-gold bg-gold text-ink",
  };
  return <span className={`chip ${styles[t.id]}`} dir="ltr">{t.name}</span>;
}

export function VerifiedBadge({ count }: { count: number }) {
  const full = count === VERIFICATION_TYPES.length;
  return (
    <span className={full ? "chip-gold" : "chip"} title={tr("{n}/{total} verificaciones", { n: count, total: VERIFICATION_TYPES.length })}>
      {full ? tr("✓ Verificación completa") : tr("{n}/{total} verificado", { n: count, total: VERIFICATION_TYPES.length })}
    </span>
  );
}

export function Stars({ value, count }: { value: number | null; count?: number }) {
  if (!value) return <span className="text-xs text-muted">{tr("Sin valoraciones")}</span>;
  return (
    <span className="text-sm text-gold-2">
      {"★".repeat(Math.round(value))}
      <span className="text-muted">{"★".repeat(5 - Math.round(value))}</span>
      <span className="ms-1 text-xs text-muted">{value.toFixed(1)}{count != null && ` (${count})`}</span>
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl text-ivory">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center text-muted">
      <p>{children}</p>
      {href && cta && <Link href={href} className="btn-gold">{cta}</Link>}
    </div>
  );
}

/** Barras horizontales simples para dashboards. */
export function Bars({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">{r.label}</span>
            <span className="tabular-nums text-ivory">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-ink-3">
            <div className="h-2 rounded-full bg-gold" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Columnas verticales (serie temporal). */
export function Columns({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex h-48 items-end gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-1 flex-col items-center gap-1" title={`${r.label}: ${format(r.value)}`}>
          <span className="text-[10px] tabular-nums text-muted">{format(r.value)}</span>
          <div className="w-full rounded-t-md bg-gradient-to-t from-gold/60 to-gold-2" style={{ height: `${Math.max(2, (r.value / max) * 140)}px` }} />
          <span className="text-[10px] text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

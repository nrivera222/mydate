import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { csv, walletBalance } from "@/lib/users";
import { tierById, VAT_RATE } from "@/lib/catalog";
import { money } from "@/lib/money";
import { bookLounge } from "../../actions/commerce";
import { Flash, sp, TierBadge, type SP } from "@/components/ui";
import { KIND_ICON, type Lounge } from "@/lib/lounges";
import { getT } from "@/lib/i18n";

export default async function LoungeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const l = one<Lounge>("SELECT l.*, pa.name AS partner FROM lounges l LEFT JOIN partners pa ON pa.id = l.partner_id WHERE l.id = ?", Number(id));
  if (!l) notFound();
  const locked = tierById(user.tier).rank < tierById(l.min_tier).rank;
  const upcoming = all<{ start_at: string; quantity: number }>(
    "SELECT start_at, quantity FROM bookings WHERE kind = 'lounge' AND lounge_id = ? AND status = 'accepted' AND datetime(start_at) > datetime('now') ORDER BY start_at LIMIT 8", l.id,
  );
  const matches = all<{ id: number; name: string }>(
    `SELECT u.id, u.name FROM likes a JOIN likes b ON b.from_id = a.to_id AND b.to_id = a.from_id JOIN users u ON u.id = a.to_id
     WHERE a.from_id = ? AND a.kind != 'pass' AND b.kind != 'pass' ORDER BY u.name`, user.id,
  );
  const minStart = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 16);

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <div className="card flex h-64 items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.4),transparent_60%)] text-8xl">
          {KIND_ICON[l.kind] ?? "✨"}
        </div>
        <div>
          <TierBadge tier={l.min_tier} />
          <h1 className="h1 mt-3">{l.name}</h1>
          <p className="text-muted">{t(l.city)}, {t(l.country)} · {t("Capacidad {n} personas", { n: l.capacity })}{l.partner ? ` · ${t("Operado con {partner}", { partner: l.partner })}` : ""}</p>
        </div>
        <p className="leading-relaxed">{t(l.description)}</p>
        <div className="flex flex-wrap gap-2">{csv(l.amenities).map((a) => <span key={a} className="chip">{t(a)}</span>)}</div>
        <div className="card text-sm">
          <h2 className="h2">{t("Protocolo TWO LOVE")}</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-muted">
            <li>{t("Anfitrión/a de la marca recibe a ambas personas y verifica identidad a la llegada.")}</li>
            <li>{t("Personal de seguridad discreto y botón de asistencia en la mesa.")}</li>
            <li>{t("Sin cámaras ni prensa. Acuerdo de confidencialidad con el recinto.")}</li>
            <li>{t("Experiencias añadibles: flores, sommelier, músico en vivo, fotógrafo.")}</li>
          </ul>
        </div>
        {upcoming.length > 0 && (
          <div className="card text-sm">
            <h2 className="h2">{t("Horarios ocupados")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">{upcoming.map((u, i) => <span key={i} className="chip">{u.start_at.slice(0, 16)} · {u.quantity} h</span>)}</div>
          </div>
        )}
      </div>
      <aside className="lg:col-span-2">
        <div className="card sticky top-32 space-y-4">
          <div className="font-display text-3xl text-glow">{money(l.price_hour)}<span className="text-base text-muted"> {t("/hora + IVA {vat}%", { vat: VAT_RATE * 100 })}</span></div>
          {locked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("Esta sala está reservada para miembros {tier} o superior.", { tier: tierById(l.min_tier).name })}</p>
              <Link href="/membresias" className="btn-brand w-full">{t("Mejorar membresía")}</Link>
            </div>
          ) : (
            <form action={bookLounge} className="space-y-3">
              <input type="hidden" name="lounge" value={l.id} />
              <div>
                <label className="label" htmlFor="start_at">{t("Fecha y hora")}</label>
                <input className="input" id="start_at" name="start_at" type="datetime-local" min={minStart} required />
              </div>
              <div>
                <label className="label" htmlFor="hours">{t("Horas")}</label>
                <input className="input" id="hours" name="hours" type="number" min={1} max={12} defaultValue={2} required />
              </div>
              <div>
                <label className="label" htmlFor="guest">{t("Invitar a un match (opcional)")}</label>
                <select className="input" id="guest" name="guest">
                  <option value="">—</option>
                  {matches.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="notes">{t("Peticiones especiales")}</label>
                <textarea className="input" id="notes" name="notes" maxLength={500} placeholder={t("Alergias, flores, música…")} />
              </div>
              <p className="text-xs text-muted">{t("Saldo: {amount}. Se cobra al confirmar.", { amount: money(walletBalance(user.id).balance) })}</p>
              <button className="btn-brand w-full" type="submit">{t("Reservar Sala")}</button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

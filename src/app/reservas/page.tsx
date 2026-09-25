import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { RATE_UNITS, RATING_TAGS } from "@/lib/catalog";
import { money } from "@/lib/money";
import { cancelBooking, completeBooking, disputeBooking, rate, respondBooking, safetyCheckin } from "../actions/commerce";
import { Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";

type Booking = {
  id: number; kind: string; client_id: number; provider_id: number | null; unit: string; quantity: number; start_at: string; activity: string; notes: string;
  subtotal: number; service_fee: number; vat: number; total: number; provider_payout: number; status: string; safety_checkin_at: string | null;
  client_name: string; provider_name: string | null; lounge_name: string | null; my_rating: number | null;
};

const STATUS: Record<string, [string, string]> = {
  requested: ["Solicitada", "chip border-sky-300/40 text-sky-200"],
  accepted: ["Confirmada", "chip-gold"],
  completed: ["Finalizada", "chip border-ok/40 text-ok"],
  declined: ["Rechazada", "chip"],
  cancelled: ["Cancelada", "chip"],
  disputed: ["En disputa", "chip border-rose/40 text-rose"],
};

function Hidden({ id }: { id: number }) {
  return <input type="hidden" name="booking" value={id} />;
}

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const rows = all<Booking>(
    `SELECT b.*, c.name AS client_name, pv.name AS provider_name, l.name AS lounge_name,
       (SELECT stars FROM ratings r WHERE r.booking_id = b.id AND r.rater_id = ?) AS my_rating
     FROM bookings b JOIN users c ON c.id = b.client_id LEFT JOIN users pv ON pv.id = b.provider_id LEFT JOIN lounges l ON l.id = b.lounge_id
     WHERE b.client_id = ? OR b.provider_id = ? ORDER BY b.start_at DESC LIMIT 60`,
    user.id, user.id, user.id,
  );
  const unitLabel = (u: string, n: number) => {
    const x = RATE_UNITS.find((r) => r.id === u);
    return x ? `${n} ${n === 1 ? x.label.toLowerCase() : x.plural}` : `${n} ${u}`;
  };

  return (
    <div>
      <PageHeader title="Reservas" subtitle="Acompañamiento social y Salas TWO LOVE. Haz check-in de seguridad el día del encuentro." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {rows.length === 0 && <Empty href="/acompanantes" cta="Explorar acompañamiento">Aún no tienes reservas.</Empty>}
      <div className="space-y-4">
        {rows.map((b) => {
          const asClient = b.client_id === user.id;
          const counterpart = asClient ? b.provider_name : b.client_name;
          const counterpartId = asClient ? b.provider_id : b.client_id;
          const [label, cls] = STATUS[b.status] ?? [b.status, "chip"];
          return (
            <article key={b.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">#{b.id}</span>
                    <span className={cls}>{label}</span>
                    <span className="chip">{b.kind === "lounge" ? "Sala TWO LOVE" : asClient ? "Contratada por ti" : "Te han contratado"}</span>
                    {b.safety_checkin_at && <span className="chip border-ok/40 text-ok">✓ Check-in {b.safety_checkin_at.slice(11, 16)}</span>}
                  </div>
                  <h2 className="mt-2 font-display text-xl">
                    {b.kind === "lounge" ? b.lounge_name : b.activity}
                    {counterpart && counterpartId && <> · <Link href={`/perfil/${counterpartId}`} className="text-gold-2">{counterpart}</Link></>}
                  </h2>
                  <p className="text-sm text-muted">{b.start_at.slice(0, 16)} · {unitLabel(b.unit, b.quantity)}</p>
                  {b.notes && <p className="mt-1 text-sm text-muted">“{b.notes}”</p>}
                </div>
                <div className="text-right text-sm">
                  {asClient ? (
                    <>
                      <div className="font-display text-2xl text-gold-2">{money(b.total)}</div>
                      <div className="text-xs text-muted">Tarifa {money(b.subtotal)} · Servicio {money(b.service_fee)} · IVA {money(b.vat)}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-2xl text-gold-2">{money(b.provider_payout)}</div>
                      <div className="text-xs text-muted">Neto tras comisión TWO LOVE</div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {b.kind === "companion" && !asClient && b.status === "requested" && (
                  <>
                    <form action={respondBooking}><Hidden id={b.id} /><input type="hidden" name="decision" value="accept" /><button className="btn-gold">Aceptar</button></form>
                    <form action={respondBooking}><Hidden id={b.id} /><input type="hidden" name="decision" value="decline" /><button className="btn-ghost">Rechazar</button></form>
                  </>
                )}
                {b.kind === "companion" && asClient && b.status === "accepted" && (
                  <form action={completeBooking}><Hidden id={b.id} /><button className="btn-gold">Confirmar encuentro y liberar pago</button></form>
                )}
                {b.kind === "companion" && asClient && ["requested", "accepted"].includes(b.status) && (
                  <form action={cancelBooking}><Hidden id={b.id} /><button className="btn-ghost">Cancelar</button></form>
                )}
                {["accepted"].includes(b.status) && !b.safety_checkin_at && (
                  <form action={safetyCheckin}><Hidden id={b.id} /><button className="btn-ghost">🛡️ Check-in de seguridad</button></form>
                )}
                {b.kind === "companion" && b.status === "accepted" && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm text-rose">Abrir disputa</summary>
                    <form action={disputeBooking} className="mt-2 flex gap-2">
                      <Hidden id={b.id} />
                      <input className="input flex-1" name="details" placeholder="¿Qué ha ocurrido?" required />
                      <button className="btn-danger">Enviar</button>
                    </form>
                  </details>
                )}
                {b.kind === "companion" && counterpartId && ["requested", "accepted", "completed"].includes(b.status) && (
                  <Link href={`/mensajes/${counterpartId}`} className="btn-ghost">💬 Mensaje</Link>
                )}
              </div>

              {b.kind === "companion" && b.status === "completed" && b.provider_id && (
                b.my_rating ? (
                  <p className="mt-3 text-sm text-muted">Tu valoración: <span className="text-gold-2">{"★".repeat(b.my_rating)}</span></p>
                ) : (
                  <form action={rate} className="mt-4 space-y-3 rounded-xl border border-line p-4">
                    <Hidden id={b.id} />
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted">Valora a {counterpart}:</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="flex items-center gap-1"><input type="radio" className="check" name="stars" value={n} defaultChecked={n === 5} />{n}★</label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {RATING_TAGS.map((t) => (
                        <label key={t} className="chip cursor-pointer has-[:checked]:border-gold has-[:checked]:text-gold-2"><input type="checkbox" className="sr-only" name="tags" value={t} />{t}</label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className="input flex-1" name="comment" placeholder="Comentario (opcional)" maxLength={500} />
                      <button className="btn-gold">Valorar</button>
                    </div>
                  </form>
                )
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

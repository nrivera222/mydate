import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp, clpM, pct } from "@/lib/money";
import { STREAM_LABEL } from "@/lib/catalog";
import { BASE_CASE, CLP_PER_AED, CLUB, PARK_STREAMS, ROADMAP, SEGMENTS, productById } from "@/lib/park-catalog";
import { pilotVenue, type ParkBooking } from "@/lib/park";
import { parkCancelAdmin, parkCheckIn, parkComplete, parkNoShow, parkPhotos, parkSale } from "../../actions/park";
import { Bars, Columns, Empty, Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";

const STATUS = { reservada: "Reservada", en_curso: "En curso", completada: "Completada", cancelada: "Cancelada", no_show: "No presentada" } as Record<string, string>;
/** fils (AED × 100) de la tabla de ingresos → CLP netos */
const toClp = (fils: number) => Math.round((fils / 100) * CLP_PER_AED);

export default async function AdminPark({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const venue = pilotVenue();
  if (!venue) return <Empty>{t("No hay locales abiertos.")}</Empty>;

  // Parejas atendidas por mes: sin reserva (caja) + reservas completadas
  const couples = all<{ m: string; n: number }>(
    `SELECT m, SUM(n) AS n FROM (
       SELECT strftime('%Y-%m', created_at) AS m, SUM(couples) AS n FROM park_sales WHERE venue_id = ? GROUP BY m
       UNION ALL SELECT strftime('%Y-%m', slot_at) AS m, COUNT(*) AS n FROM park_bookings WHERE venue_id = ? AND status = 'completada' GROUP BY m
     ) WHERE m >= strftime('%Y-%m', date('now', 'start of month', '-5 months')) GROUP BY m ORDER BY m`, venue.id, venue.id,
  );
  const revenueByMonth = all<{ m: string; v: number }>(
    "SELECT strftime('%Y-%m', created_at) AS m, SUM(amount) AS v FROM revenue WHERE stream LIKE 'park_%' AND created_at >= date('now', 'start of month', '-5 months') GROUP BY m ORDER BY m",
  );
  const last30 = all<{ stream: string; v: number }>("SELECT stream, SUM(amount) AS v FROM revenue WHERE stream LIKE 'park_%' AND created_at >= datetime('now', '-30 days') GROUP BY stream");
  const rev30 = toClp(last30.reduce((a, r) => a + r.v, 0));
  const couples30 = one<{ n: number }>(
    `SELECT COALESCE((SELECT SUM(couples) FROM park_sales WHERE venue_id = ? AND created_at >= datetime('now','-30 days')), 0)
          + (SELECT COUNT(*) FROM park_bookings WHERE venue_id = ? AND status = 'completada' AND slot_at >= datetime('now','-30 days')) AS n`, venue.id, venue.id,
  )!.n;
  const ebitda30 = Math.round(rev30 * BASE_CASE.contribution - BASE_CASE.fixedCosts);
  const perCouple = couples30 ? Math.round(rev30 / couples30) : 0;

  // Mes del piloto y regla de decisión (mes 6: promedio ≥ 900 parejas)
  const month = Math.max(1, Math.ceil((Date.now() - new Date(`${venue.opens_on}T00:00:00Z`).getTime()) / (30 * 86_400_000)));
  // Ritmo actual: parejas de los últimos 30 días
  const avg = couples30;
  const decisionOk = avg >= BASE_CASE.conservative;

  const clubMembers = one<{ n: number }>("SELECT COUNT(*) AS n FROM park_club WHERE datetime(expires_at) > datetime('now')")!.n
    + one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'user' AND tier IN ('diamond','royal')")!.n;
  // Recompra a 60 días: parejas con otra cita completada dentro de los 60 días siguientes a la primera
  const repeat = one<{ base: number; again: number }>(
    `WITH f AS (SELECT user_id, MIN(slot_at) AS first FROM park_bookings WHERE status = 'completada' GROUP BY user_id HAVING first <= datetime('now', '-60 days'))
     SELECT COUNT(*) AS base, SUM(EXISTS (SELECT 1 FROM park_bookings b WHERE b.user_id = f.user_id AND b.status = 'completada' AND b.slot_at > f.first AND b.slot_at <= datetime(f.first, '+60 days'))) AS again FROM f`,
  )!;
  const repeatRate = repeat.base ? (repeat.again ?? 0) / repeat.base : 0;

  const segRows = all<{ seg: string; n: number }>(
    `SELECT CASE WHEN b.minor = 1 THEN 'teen' WHEN p.birth_year IS NULL THEN 'young'
       WHEN strftime('%Y','now') - p.birth_year <= 30 THEN 'young' WHEN strftime('%Y','now') - p.birth_year < 60 THEN 'adult' ELSE 'senior' END AS seg, COUNT(*) AS n
     FROM park_bookings b LEFT JOIN profiles p ON p.user_id = b.user_id WHERE b.status IN ('completada','reservada','en_curso') GROUP BY seg`,
  );
  const segTotal = Math.max(1, segRows.reduce((a, r) => a + r.n, 0));

  const agenda = all<ParkBooking & { name: string; photos: number }>(
    `SELECT b.*, u.name, (SELECT COUNT(*) FROM park_photos f WHERE f.booking_id = b.id) AS photos FROM park_bookings b JOIN users u ON u.id = b.user_id
     WHERE b.venue_id = ? AND (date(b.slot_at) BETWEEN date('now') AND date('now', '+2 days') OR b.status = 'en_curso') ORDER BY b.slot_at`, venue.id,
  );
  const machines = all<{ id: number; kind: string; name: string; units: number; investment: number; payback_months: number; sold: number }>(
    `SELECT m.*, COALESCE((SELECT SUM(amount) FROM park_sales s WHERE s.machine_id = m.id), 0) AS sold FROM park_machines m WHERE m.venue_id = ? ORDER BY m.kind DESC, m.investment DESC`, venue.id,
  );
  const monthsOpen = Math.max(1, month);

  return (
    <div>
      <PageHeader title={t("TWO LOVE Park · operación")} subtitle={`${venue.name} · ${t(venue.city)} · ${t("Mes {n} del piloto", { n: month })}`} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={t("Parejas 30 días")} value={couples30.toLocaleString()} hint={t("Equilibrio {a} · caso base {b}", { a: BASE_CASE.breakeven, b: BASE_CASE.couples.toLocaleString() })} />
        <Stat label={t("Ingresos netos 30 días")} value={clpM(rev30)} hint={t("Caso base {v}", { v: clpM(Object.values(BASE_CASE.revenue).reduce((a, b) => a + b, 0)) })} />
        <Stat label={t("EBITDA estimado 30 días")} value={<span className={ebitda30 >= 0 ? "text-ok" : "text-rose"}>{clpM(ebitda30)}</span>} hint={t("Margen de contribución {c} · costos fijos {f}", { c: pct(BASE_CASE.contribution), f: clpM(BASE_CASE.fixedCosts) })} />
        <Stat label={t("Ingreso por pareja")} value={clp(perCouple)} hint={t("Objetivo {v}", { v: clp(27_300) })} />
      </div>

      <div className={`mt-4 rounded-2xl border p-4 text-sm ${decisionOk ? "border-ok/40 bg-ok/10" : "border-rose/40 bg-rose/10"}`}>
        <b>{t("Regla de decisión del mes {n}", { n: BASE_CASE.decisionMonth })}:</b>{" "}
        {t("ritmo de {avg} parejas en los últimos 30 días (umbral {min} al mes).", { avg, min: BASE_CASE.conservative })}{" "}
        {decisionOk ? t("El piloto sigue según el plan.") : month >= BASE_CASE.decisionMonth ? t("Bajo el umbral: ajustar costos o cerrar el piloto.") : t("Bajo el umbral: vigilar antes del mes 6.")}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-4">{t("Parejas atendidas por mes")}</h2>
          <Columns rows={couples.map((r) => ({ label: r.m.slice(5), value: r.n }))} format={(n) => n.toLocaleString()} />
        </section>
        <section className="card">
          <h2 className="h2 mb-4">{t("Ingresos netos por mes")}</h2>
          <Columns rows={revenueByMonth.map((r) => ({ label: r.m.slice(5), value: toClp(r.v) }))} format={clpM} />
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="h2">{t("Agenda: hoy y próximos 2 días")}</h2>
        {agenda.length === 0 ? <p className="mt-3 text-sm text-muted">{t("Sin reservas.")}</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{t("Hora")}</th><th>{t("Reserva")}</th><th>{t("Cliente")}</th><th>{t("Pagado")}</th><th>{t("Estado")}</th><th>{t("Acciones")}</th></tr></thead>
              <tbody>
                {agenda.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap">{b.slot_at.slice(5, 16)}</td>
                    <td>
                      {t(productById(b.product)?.name ?? b.product)}{b.destination ? ` · ${t(b.destination)}` : ""}
                      <div className="font-mono text-[10px] text-muted">{b.qr}</div>
                      {b.minor ? <span className="chip border-electric/50 text-electric">{t("Menores · tutor")}: {b.minor_names}</span> : null}
                    </td>
                    <td>{b.name}{b.partner_name ? ` + ${b.partner_name}` : ""}</td>
                    <td className="whitespace-nowrap">{clp(b.paid)} / {clp(b.total)}</td>
                    <td><span className="chip">{t(STATUS[b.status] ?? b.status)}</span></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        {b.status === "reservada" && (
                          <>
                            <form action={parkCheckIn} className="flex items-center gap-1">
                              <input type="hidden" name="booking" value={b.id} />
                              <select name="method" className="input w-auto py-1 text-xs" aria-label={t("Cobro del saldo")}>
                                <option value="wallet">{t("Saldo desde billetera")}</option>
                                <option value="local">{t("Pagado en el local")}</option>
                              </select>
                              <button className="btn-brand px-3 py-1 text-xs" type="submit">{t("Check-in")}</button>
                            </form>
                            <form action={parkNoShow}><input type="hidden" name="booking" value={b.id} /><button className="text-xs text-muted underline" type="submit">{t("No vino")}</button></form>
                            <form action={parkCancelAdmin}><input type="hidden" name="booking" value={b.id} /><button className="text-xs text-rose underline" type="submit">{t("Cancelar")}</button></form>
                          </>
                        )}
                        {b.status === "en_curso" && (
                          <form action={parkComplete}><input type="hidden" name="booking" value={b.id} /><button className="btn-brand px-3 py-1 text-xs" type="submit">{t("Completar y sellar")}</button></form>
                        )}
                        {b.photo_consent && ["en_curso", "completada"].includes(b.status) ? (
                          <form action={parkPhotos} className="flex items-center gap-1">
                            <input type="hidden" name="booking" value={b.id} />
                            <input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple className="max-w-40 text-xs" aria-label={t("Fotos de cabina")} />
                            <button className="btn-ghost px-3 py-1 text-xs" type="submit">{t("Subir fotos")} ({b.photos})</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-4">{t("Ingresos 30 días por línea vs. caso base")}</h2>
          <div className="space-y-3">
            {PARK_STREAMS.map((s) => {
              const v = toClp(last30.find((r) => r.stream === s)?.v ?? 0);
              const target = BASE_CASE.revenue[s];
              return (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{t(STREAM_LABEL[s])}</span><span className="tabular-nums">{clpM(v)} / {clpM(target)}</span></div>
                  <div className="h-2 rounded-full bg-ink-3"><div className="h-2 rounded-full bg-linear-to-r from-electric to-brand" style={{ width: `${Math.min(100, (v / target) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card space-y-5">
          <div>
            <h2 className="h2">{t("Fidelización")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-line p-3"><div className="text-muted">{t("Socios Two Love Club")}</div><div className="font-display text-2xl">{clubMembers}</div><div className="text-xs text-muted">{t("Meta {n}", { n: CLUB.targetMembers })}</div></div>
              <div className="rounded-xl border border-line p-3"><div className="text-muted">{t("Recompra a 60 días")}</div><div className="font-display text-2xl">{pct(repeatRate)}</div><div className="text-xs text-muted">{t("Meta {n}", { n: pct(CLUB.targetRepeat) })}</div></div>
            </div>
          </div>
          <div>
            <h2 className="h2 mb-3">{t("Segmentos (reservas)")}</h2>
            <Bars rows={SEGMENTS.map((s) => ({ label: `${t(s.range)} · ${t("plan")} ${pct(s.share)}`, value: (segRows.find((r) => r.seg === s.id)?.n ?? 0) / segTotal }))} format={pct} />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="h2">{t("Máquinas y cabinas")}</h2>
          <table className="tbl mt-4">
            <thead><tr><th>{t("Equipo")}</th><th>{t("Uds.")}</th><th>{t("Inversión")}</th><th>{t("Ventas")}</th><th>{t("Recuperación")}</th></tr></thead>
            <tbody>
              {machines.map((m) => {
                const recovered = Math.min(1, (m.sold / 1.19) * BASE_CASE.contribution / m.investment);
                const expected = Math.min(1, monthsOpen / m.payback_months);
                return (
                  <tr key={m.id}>
                    <td>{t(m.name)}<div className="text-[10px] text-muted">{m.kind === "cabina" ? t("Cabina") : t("Máquina")} · {t("plan {n} meses", { n: m.payback_months })}</div></td>
                    <td>{m.units}</td>
                    <td className="whitespace-nowrap">{clpM(m.investment)}</td>
                    <td className="whitespace-nowrap">{clpM(m.sold)}</td>
                    <td className="w-40">
                      <div className="h-2 rounded-full bg-ink-3"><div className={`h-2 rounded-full ${recovered >= expected * 0.9 ? "bg-ok" : "bg-brand"}`} style={{ width: `${recovered * 100}%` }} /></div>
                      <div className="mt-1 text-[10px] text-muted">{pct(recovered)} · {t("esperado {v}", { v: pct(expected) })}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section id="caja" className="card lg:col-span-2">
          <h2 className="h2">{t("Registrar venta en caja")}</h2>
          <form action={parkSale} className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="stream">{t("Línea")}</label>
              <select className="input" id="stream" name="stream">{PARK_STREAMS.map((s) => <option key={s} value={s}>{t(STREAM_LABEL[s])}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="machine">{t("Máquina o cabina (opcional)")}</label>
              <select className="input" id="machine" name="machine"><option value="">—</option>{machines.map((m) => <option key={m.id} value={m.id}>{t(m.name)}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="amount">{t("Importe (CLP, IVA incl.)")}</label><input className="input" id="amount" name="amount" type="number" min={1} required /></div>
              <div><label className="label" htmlFor="couples">{t("Parejas sin reserva")}</label><input className="input" id="couples" name="couples" type="number" min={0} defaultValue={0} /></div>
            </div>
            <div><label className="label" htmlFor="note">{t("Nota")}</label><input className="input" id="note" name="note" maxLength={200} /></div>
            <button className="btn-brand w-full" type="submit">{t("Registrar")}</button>
          </form>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="h2">{t("Hoja de ruta")}</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-4">
          {ROADMAP.map((r, i) => (
            <li key={r.name} className={`rounded-xl border p-4 text-sm ${i === 2 ? "border-brand bg-brand/10" : "border-line"}`}>
              <div className="text-xs text-muted">{t(r.when)}</div>
              <div className="mt-1 font-display text-lg">{t(r.name)}</div>
              <p className="mt-1 text-muted">{t(r.desc)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">{t("Solo se avanza a la etapa siguiente si se cumple la métrica de salida.")}</p>
      </section>
    </div>
  );
}

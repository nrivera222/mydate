import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { EVENT_SELECT, type EventRow } from "@/lib/events";
import { CITIES, TIERS } from "@/lib/catalog";
import { money } from "@/lib/money";
import { cancelEvent, createEvent } from "../../actions/admin";
import { Flash, PageHeader, sp, TierBadge, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function AdminEvents({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const events = all<EventRow & { revenue: number }>(
    `SELECT x.*, COALESCE((SELECT SUM(price) FROM event_tickets t WHERE t.event_id = x.id AND t.status = 'confirmada'), 0) AS revenue
     FROM (${EVENT_SELECT}) x ORDER BY x.starts_at DESC`,
  );

  return (
    <div>
      <PageHeader title={t("Eventos")} subtitle={t("Programación de eventos privados, aforo, ventas y cancelaciones con reembolso automático.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>{t("Evento")}</th><th>{t("Fecha")}</th><th>{t("Nivel")}</th><th className="text-end">{t("Precio")}</th><th className="text-end">{t("Vendidas")}</th><th className="text-end">{t("Ingresos")}</th><th /></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/eventos/${e.id}`} className="hover:text-gold-2">{e.emoji} {t(e.title)}</Link><div className="text-xs text-muted">{t(e.venue)}, {t(e.city)}</div></td>
                <td className="whitespace-nowrap text-muted">{e.starts_at.slice(0, 16)}</td>
                <td><TierBadge tier={e.min_tier} /></td>
                <td className="text-end tabular-nums">{money(e.price)}</td>
                <td className="text-end">{e.sold}/{e.capacity}</td>
                <td className="text-end tabular-nums text-gold-2">{money(e.revenue)}</td>
                <td>
                  {e.status === "publicado" ? (
                    <form action={cancelEvent}><input type="hidden" name="id" value={e.id} /><button className="btn-danger px-3 py-1">{t("Cancelar")}</button></form>
                  ) : <span className="chip">{e.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form action={createEvent} className="card mt-8 grid gap-3 md:grid-cols-4">
        <h2 className="h2 md:col-span-4">{t("Nuevo evento")}</h2>
        <input className="input md:col-span-2" name="title" placeholder={t("Título")} required />
        <input className="input" name="emoji" placeholder={t("Emoji (✨)")} maxLength={8} />
        <input className="input" name="starts_at" type="datetime-local" required />
        <select className="input" name="city" required>{CITIES.map((c) => <option key={c.city} value={c.city}>{t(c.city)}</option>)}</select>
        <input className="input md:col-span-2" name="venue" placeholder={t("Lugar")} required />
        <select className="input" name="min_tier">{TIERS.map((x) => <option key={x.id} value={x.id}>{x.name}+</option>)}</select>
        <input className="input" name="capacity" type="number" min={2} placeholder={t("Aforo")} required />
        <input className="input" name="price" type="number" min={0} placeholder={t("Precio AED (sin IVA)")} required />
        <textarea className="input md:col-span-4" name="description" placeholder={t("Descripción")} maxLength={1000} />
        <button className="btn-gold md:col-span-4">{t("Publicar evento")}</button>
      </form>
    </div>
  );
}

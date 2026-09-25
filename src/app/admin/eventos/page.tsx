import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { EVENT_SELECT, type EventRow } from "@/lib/events";
import { CITIES, TIERS } from "@/lib/catalog";
import { money } from "@/lib/money";
import { cancelEvent, createEvent } from "../../actions/admin";
import { Flash, PageHeader, sp, TierBadge, type SP } from "@/components/ui";

export default async function AdminEvents({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams;
  const events = all<EventRow & { revenue: number }>(
    `SELECT x.*, COALESCE((SELECT SUM(price) FROM event_tickets t WHERE t.event_id = x.id AND t.status = 'confirmada'), 0) AS revenue
     FROM (${EVENT_SELECT}) x ORDER BY x.starts_at DESC`,
  );

  return (
    <div>
      <PageHeader title="Eventos" subtitle="Programación de eventos privados, aforo, ventas y cancelaciones con reembolso automático." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Evento</th><th>Fecha</th><th>Nivel</th><th className="text-right">Precio</th><th className="text-right">Vendidas</th><th className="text-right">Ingresos</th><th /></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/eventos/${e.id}`} className="hover:text-gold-2">{e.emoji} {e.title}</Link><div className="text-xs text-muted">{e.venue}, {e.city}</div></td>
                <td className="whitespace-nowrap text-muted">{e.starts_at.slice(0, 16)}</td>
                <td><TierBadge tier={e.min_tier} /></td>
                <td className="text-right tabular-nums">{money(e.price)}</td>
                <td className="text-right">{e.sold}/{e.capacity}</td>
                <td className="text-right tabular-nums text-gold-2">{money(e.revenue)}</td>
                <td>
                  {e.status === "publicado" ? (
                    <form action={cancelEvent}><input type="hidden" name="id" value={e.id} /><button className="btn-danger px-3 py-1">Cancelar</button></form>
                  ) : <span className="chip">{e.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form action={createEvent} className="card mt-8 grid gap-3 md:grid-cols-4">
        <h2 className="h2 md:col-span-4">Nuevo evento</h2>
        <input className="input md:col-span-2" name="title" placeholder="Título" required />
        <input className="input" name="emoji" placeholder="Emoji (✨)" maxLength={8} />
        <input className="input" name="starts_at" type="datetime-local" required />
        <select className="input" name="city" required>{CITIES.map((c) => <option key={c.city}>{c.city}</option>)}</select>
        <input className="input md:col-span-2" name="venue" placeholder="Lugar" required />
        <select className="input" name="min_tier">{TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}+</option>)}</select>
        <input className="input" name="capacity" type="number" min={2} placeholder="Aforo" required />
        <input className="input" name="price" type="number" min={0} placeholder="Precio AED (sin IVA)" required />
        <textarea className="input md:col-span-4" name="description" placeholder="Descripción" maxLength={1000} />
        <button className="btn-gold md:col-span-4">Publicar evento</button>
      </form>
    </div>
  );
}

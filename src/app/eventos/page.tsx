import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { EVENT_SELECT, type EventRow } from "@/lib/events";
import { tierById } from "@/lib/catalog";
import { money } from "@/lib/money";
import { Empty, Flash, PageHeader, sp, TierBadge, type SP } from "@/components/ui";

export default async function Events({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const events = all<EventRow>(`${EVENT_SELECT} WHERE e.status = 'publicado' AND datetime(e.starts_at) > datetime('now') ORDER BY e.starts_at`);
  const mine = new Set(all<{ event_id: number }>("SELECT event_id FROM event_tickets WHERE user_id = ? AND status = 'confirmada'", user.id).map((t) => t.event_id));
  const rank = tierById(user.tier).rank;

  return (
    <div>
      <PageHeader title="Eventos privados" subtitle="Cenas, fiestas y experiencias exclusivas para conocer a otros miembros verificados en persona. Aforo limitado." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {events.length === 0 && <Empty>No hay eventos próximos. ¡Vuelve pronto!</Empty>}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => {
          const locked = rank < tierById(e.min_tier).rank;
          const left = e.capacity - e.sold;
          return (
            <Link key={e.id} href={`/eventos/${e.id}`} className={`card flex flex-col gap-3 transition hover:border-gold/60 ${locked ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="text-4xl">{e.emoji}</span>
                <TierBadge tier={e.min_tier} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gold-2">{e.starts_at.slice(0, 16).replace(" ", " · ")}</div>
                <div className="mt-1 font-display text-xl">{e.title}</div>
                <div className="text-sm text-muted">{e.venue}, {e.city}</div>
              </div>
              <p className="line-clamp-3 text-sm text-muted">{e.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                <span className="text-gold-2">{e.price ? money(e.price) : "Invitación"}</span>
                {mine.has(e.id) ? <span className="chip-gold">✓ Tienes entrada</span> : left <= 0 ? <span className="chip">Agotado</span> : locked ? <span className="chip">🔒 {tierById(e.min_tier).name}</span> : <span className="chip">{left} plazas</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

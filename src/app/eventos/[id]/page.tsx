import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { EVENT_SELECT, type EventRow } from "@/lib/events";
import { archetypeLabel, tierById, VAT_RATE } from "@/lib/catalog";
import { money, pct } from "@/lib/money";
import { walletBalance } from "@/lib/users";
import { buyTicket } from "../../actions/commerce";
import { Avatar, Flash, sp, TierBadge, type SP } from "@/components/ui";

export default async function EventDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const e = one<EventRow>(`${EVENT_SELECT} WHERE e.id = ?`, Number(id));
  if (!e) notFound();
  const tier = tierById(user.tier);
  const ticket = one<{ id: number; created_at: string }>("SELECT id, created_at FROM event_tickets WHERE event_id = ? AND user_id = ? AND status = 'confirmada'", e.id, user.id);
  const locked = tier.rank < tierById(e.min_tier).rank;
  const past = new Date(e.starts_at.replace(" ", "T") + "Z").getTime() < Date.now();
  const net = e.price - Math.round(e.price * tier.giftDiscount);
  // "Quién va" solo es visible para quien tiene entrada (privacidad de los asistentes)
  const attendees = ticket
    ? all<{ id: number; name: string; hue: number; photo_path: string | null; archetype: string; incognito: number }>(
        `SELECT u.id, u.name, p.hue, p.photo_path, p.archetype, p.incognito FROM event_tickets t JOIN users u ON u.id = t.user_id JOIN profiles p ON p.user_id = u.id
         WHERE t.event_id = ? AND t.status = 'confirmada' AND u.id != ? ORDER BY t.id`, e.id, user.id,
      ).filter((a) => !a.incognito)
    : [];

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <div className="card flex h-56 items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(201,162,75,0.35),transparent_60%)] text-8xl">{e.emoji}</div>
        <div>
          <div className="flex gap-2"><TierBadge tier={e.min_tier} />{e.status !== "publicado" && <span className="chip border-rose/40 text-rose">Cancelado</span>}</div>
          <h1 className="h1 mt-3">{e.title}</h1>
          <p className="text-gold-2">{e.starts_at.slice(0, 16).replace(" ", " · ")}</p>
          <p className="text-muted">{e.venue}, {e.city}{e.partner ? ` · con ${e.partner}` : ""}</p>
        </div>
        <p className="leading-relaxed">{e.description}</p>
        {ticket && (
          <section className="card">
            <h2 className="h2 mb-3">Quién va ({attendees.length})</h2>
            {attendees.length === 0 ? <p className="text-sm text-muted">Eres de los primeros. ¡Invita a tus matches!</p> : (
              <div className="flex flex-wrap gap-4">
                {attendees.map((a) => (
                  <Link key={a.id} href={`/perfil/${a.id}`} className="flex w-20 flex-col items-center gap-1 text-center text-xs">
                    <Avatar name={a.name} hue={a.hue} photo={a.photo_path} size={56} />
                    <span>{a.name.split(" ")[0]}</span>
                    <span className="text-muted">{archetypeLabel(a.archetype)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <aside className="lg:col-span-2">
        <div className="card sticky top-32 space-y-4">
          <div className="font-display text-3xl text-gold-2">{e.price ? money(net) : "Sin coste"}</div>
          {e.price > 0 && <p className="text-xs text-muted">+ IVA {VAT_RATE * 100}%{tier.giftDiscount ? ` · incluye tu descuento ${tier.name} de ${pct(tier.giftDiscount)}` : ""}</p>}
          <div className="text-sm text-muted">{Math.max(0, e.capacity - e.sold)} de {e.capacity} plazas disponibles</div>
          <div className="h-2 rounded-full bg-ink-3"><div className="h-2 rounded-full bg-gold" style={{ width: `${Math.min(100, (e.sold / e.capacity) * 100)}%` }} /></div>
          {ticket ? (
            <div className="rounded-xl border border-gold/40 p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-muted">Tu entrada</div>
              <div className="mt-1 font-mono text-2xl tracking-widest text-gold-2">TL-{e.id}-{ticket.id.toString().padStart(4, "0")}</div>
              <div className="mt-1 text-xs text-muted">Muéstrala junto con tu documento en la entrada.</div>
            </div>
          ) : past || e.status !== "publicado" ? (
            <p className="text-sm text-muted">Este evento ya no admite reservas.</p>
          ) : locked ? (
            <Link href="/membresias" className="btn-gold w-full">Requiere {tierById(e.min_tier).name}</Link>
          ) : (
            <form action={buyTicket} className="space-y-2">
              <input type="hidden" name="event" value={e.id} />
              <button className="btn-gold w-full" type="submit" disabled={e.sold >= e.capacity}>{e.sold >= e.capacity ? "Agotado" : "Reservar mi plaza"}</button>
              <p className="text-center text-xs text-muted">Saldo: {money(walletBalance(user.id).balance)}</p>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { tierById } from "@/lib/catalog";
import { requestConcierge } from "../actions/commerce";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";

export default async function Concierge({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const q = await searchParams;
  const tier = tierById(user.tier);
  const requests = all<{ id: number; body: string; status: string; created_at: string }>(
    "SELECT * FROM concierge_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20", user.id,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Concierge 24/7" subtitle="Reservas imposibles, regalos a medida, viajes y logística de citas en cualquier ciudad del mundo." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {tier.concierge ? (
        <form action={requestConcierge} className="card space-y-3">
          <label className="label" htmlFor="body">¿En qué podemos ayudarte?</label>
          <textarea className="input min-h-32" id="body" name="body" required maxLength={1000} placeholder="p. ej. Mesa para dos en Mónaco durante el Grand Prix y un ramo de peonías en la mesa." />
          <button className="btn-gold" type="submit">Enviar al concierge</button>
          {tier.matchmaker && <p className="text-sm text-gold-2">Como miembro Royal Black, tu matchmaker personal también recibirá esta solicitud.</p>}
        </form>
      ) : (
        <div className="card space-y-4 text-center">
          <p className="text-muted">El concierge 24/7 está incluido en las membresías Diamond y Royal Black.</p>
          <Link href="/membresias" className="btn-gold">Ver membresías</Link>
        </div>
      )}
      {requests.length > 0 && (
        <ul className="card mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 border-b border-line/60 pb-3 text-sm last:border-0">
              <span>{r.body}</span>
              <span className="chip whitespace-nowrap">{r.status.replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

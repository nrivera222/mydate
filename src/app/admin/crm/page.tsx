import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { fullyVerifiedIds } from "@/lib/discovery";
import { archetypeLabel, TIERS, tierById } from "@/lib/catalog";
import { money } from "@/lib/money";
import { updateConcierge } from "../../actions/admin";
import { Flash, PageHeader, sp, TierBadge, type SP } from "@/components/ui";

type Row = {
  id: number; name: string; email: string; tier: string; status: string; source: string; created_at: string; last_active_at: string;
  city: string; archetype: string; ltv: number; spend: number; balance: number;
};

export const dynamic = "force-dynamic";

function stage(r: Row, verified: boolean) {
  const inactiveDays = (Date.now() - new Date(r.last_active_at.replace(" ", "T") + "Z").getTime()) / 86_400_000;
  if (r.status !== "active") return ["Suspendido", "chip border-rose/40 text-rose"] as const;
  if (!verified) return ["Lead · verificando", "chip border-sky-300/40 text-sky-200"] as const;
  if (inactiveDays > 14) return ["En riesgo", "chip border-rose/40 text-rose"] as const;
  if (tierById(r.tier).rank >= 3) return ["VIP", "chip-gold"] as const;
  if (tierById(r.tier).rank >= 1) return ["Suscriptor", "chip border-ok/40 text-ok"] as const;
  return ["Verificado · free", "chip"] as const;
}

export default async function Crm({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const q = await searchParams;
  const search = (sp(q.q) ?? "").toLowerCase();
  const tierFilter = sp(q.tier);
  const stageFilter = sp(q.stage);
  const verified = fullyVerifiedIds();

  const rows = all<Row>(
    `SELECT u.id, u.name, u.email, u.tier, u.status, u.source, u.created_at, u.last_active_at, p.city, p.archetype,
       COALESCE((SELECT SUM(amount) FROM revenue r WHERE r.user_id = u.id), 0) AS ltv,
       COALESCE((SELECT -SUM(amount) FROM wallet_tx t WHERE t.user_id = u.id AND t.amount < 0), 0) AS spend,
       COALESCE((SELECT balance FROM wallets w WHERE w.user_id = u.id), 0) AS balance
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.role = 'user' ORDER BY ltv DESC`,
  ).map((r) => ({ ...r, stage: stage(r, verified.has(r.id)) }));

  const filtered = rows.filter((r) =>
    (!search || r.name.toLowerCase().includes(search) || r.email.includes(search)) &&
    (!tierFilter || r.tier === tierFilter) && (!stageFilter || r.stage[0] === stageFilter),
  );
  const stages = [...new Set(rows.map((r) => r.stage[0]))];
  const sources = Object.entries(rows.reduce<Record<string, number>>((acc, r) => ((acc[r.source] = (acc[r.source] ?? 0) + 1), acc), {}));
  const concierge = all<{ id: number; user_id: number; name: string; tier: string; body: string; status: string; created_at: string }>(
    "SELECT c.*, u.name, u.tier FROM concierge_requests c JOIN users u ON u.id = c.user_id ORDER BY c.status = 'resuelto', c.id DESC LIMIT 20",
  );

  return (
    <div>
      <PageHeader title="CRM" subtitle="Ciclo de vida del miembro, valor (LTV), segmentos, canales de adquisición y solicitudes de concierge." />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="label">Embudo</div>
          <div className="flex flex-wrap gap-2">{stages.map((s) => <Link key={s} href={`/admin/crm?stage=${encodeURIComponent(s)}`} className="chip">{s}: {rows.filter((r) => r.stage[0] === s).length}</Link>)}</div>
        </div>
        <div className="card">
          <div className="label">Canales de adquisición</div>
          <div className="flex flex-wrap gap-2">{sources.map(([s, n]) => <span key={s} className="chip">{s.replace("_", " ")}: {n}</span>)}</div>
        </div>
        <div className="card">
          <div className="label">LTV medio</div>
          <div className="font-display text-2xl text-gold-2">{money(rows.reduce((a, r) => a + r.ltv, 0) / Math.max(1, rows.length))}</div>
        </div>
      </div>

      <form className="card mb-6 grid gap-3 md:grid-cols-4" method="get">
        <input className="input" name="q" defaultValue={search} placeholder="Buscar nombre o email" />
        <select className="input" name="tier" defaultValue={tierFilter ?? ""}>
          <option value="">Todas las membresías</option>
          {TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input" name="stage" defaultValue={stageFilter ?? ""}>
          <option value="">Todas las etapas</option>
          {stages.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-gold">Filtrar</button>
      </form>

      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Miembro</th><th>Etapa</th><th>Plan</th><th>Ciudad · prototipo</th><th className="text-right">LTV (neto)</th><th className="text-right">Gasto</th><th className="text-right">Saldo</th><th>Últ. actividad</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/crm/${r.id}`} className="hover:text-gold-2">{r.name}</Link><div className="text-xs text-muted">{r.email}</div></td>
                <td><span className={r.stage[1]}>{r.stage[0]}</span></td>
                <td><TierBadge tier={r.tier} /></td>
                <td className="text-muted">{r.city} · {archetypeLabel(r.archetype)}</td>
                <td className="text-right tabular-nums text-gold-2">{money(r.ltv)}</td>
                <td className="text-right tabular-nums">{money(r.spend)}</td>
                <td className="text-right tabular-nums text-muted">{money(r.balance)}</td>
                <td className="whitespace-nowrap text-muted">{r.last_active_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="concierge" className="card mt-8">
        <h2 className="h2 mb-3">Solicitudes de concierge</h2>
        {concierge.length === 0 ? <p className="text-sm text-muted">Sin solicitudes.</p> : (
          <ul className="space-y-3">
            {concierge.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3 text-sm last:border-0">
                <div>
                  <Link href={`/admin/crm/${c.user_id}`} className="font-medium hover:text-gold-2">{c.name}</Link> <TierBadge tier={c.tier} />
                  <p className="text-muted">{c.body}</p>
                </div>
                <form action={updateConcierge} className="flex gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="status" defaultValue={c.status} className="input w-36">
                    <option value="nuevo">Nuevo</option><option value="en_curso">En curso</option><option value="resuelto">Resuelto</option>
                  </select>
                  <button className="btn-ghost">Guardar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

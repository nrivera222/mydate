import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { csv, getProfile, ratingSummary, verificationStatus, walletBalance } from "@/lib/users";
import { archetypeLabel, STREAM_LABEL, VERIFICATION_TYPES } from "@/lib/catalog";
import { money } from "@/lib/money";
import { addCrmNote, grantCredit, setUserStatus } from "../../../actions/admin";
import { Avatar, Flash, sp, Stars, Stat, TierBadge, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function Customer360({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const t = await getT();
  const admin = await requireAdmin();
  const { id } = await params;
  const q = await searchParams;
  const p = getProfile(Number(id));
  if (!p || p.user_id === admin.id) notFound();
  const status = one<{ status: string; source: string }>("SELECT status, source FROM users WHERE id = ?", p.user_id)!;
  const v = verificationStatus(p.user_id);
  const w = walletBalance(p.user_id);
  const rating = ratingSummary(p.user_id);
  const ltv = one<{ v: number }>("SELECT COALESCE(SUM(amount), 0) AS v FROM revenue WHERE user_id = ?", p.user_id)!.v;
  const byStream = all<{ stream: string; v: number }>("SELECT stream, SUM(amount) AS v FROM revenue WHERE user_id = ? GROUP BY stream", p.user_id);
  const notes = all<{ id: number; kind: string; body: string; created_at: string; author: string }>(
    "SELECT n.*, u.name AS author FROM crm_notes n JOIN users u ON u.id = n.author_id WHERE n.user_id = ? ORDER BY n.id DESC", p.user_id,
  );
  const txs = all<{ id: number; type: string; amount: number; description: string; created_at: string }>("SELECT * FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT 15", p.user_id);
  const bookings = all<{ id: number; kind: string; status: string; total: number; start_at: string }>(
    "SELECT id, kind, status, total, start_at FROM bookings WHERE client_id = ? OR provider_id = ? ORDER BY id DESC LIMIT 10", p.user_id, p.user_id,
  );
  const reports = one<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE reported_id = ?", p.user_id)!.n;
  const policy = one<{ plan: string; coverage: number }>("SELECT plan, coverage FROM insurance_policies WHERE user_id = ? AND status = 'active' ORDER BY id DESC", p.user_id);

  return (
    <div>
      <Link href="/admin/crm" className="text-sm text-muted hover:text-gold-2">{t("← CRM")}</Link>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar name={p.name} hue={p.hue} photo={p.photo_path} size={72} />
        <div className="flex-1">
          <h1 className="h1">{p.name}</h1>
          <p className="text-muted">{p.email} · {t(p.city)} · {t(archetypeLabel(p.archetype))} · {t("alta {date}", { date: p.created_at.slice(0, 10) })} · {t("canal {source}", { source: t(status.source) })}</p>
          <div className="mt-2 flex flex-wrap gap-2"><TierBadge tier={p.tier} /><span className="chip">{t("{n}/{total} verificado", { n: v.approved, total: 5 })}</span>{status.status !== "active" && <span className="chip border-rose/40 text-rose">{t("Suspendido")}</span>}{reports > 0 && <span className="chip border-rose/40 text-rose">{t("{n} denuncias", { n: reports })}</span>}</div>
        </div>
        <form action={setUserStatus}>
          <input type="hidden" name="user" value={p.user_id} />
          <input type="hidden" name="status" value={status.status === "active" ? "suspended" : "active"} />
          <button className={status.status === "active" ? "btn-danger" : "btn-gold"}>{status.status === "active" ? t("Suspender") : t("Reactivar")}</button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label={t("LTV neto")} value={money(ltv)} />
        <Stat label={t("Saldo billetera")} value={money(w.balance)} hint={t("{amount} en custodia", { amount: money(w.held) })} />
        <Stat label={t("Valoración")} value={<Stars value={rating.avg} count={rating.n} />} />
        <Stat label={t("Seguro de vida")} value={policy ? policy.plan : "—"} hint={policy ? t("Cobertura {c}", { c: money(policy.coverage) }) : t("Sin póliza")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card space-y-4 lg:col-span-2">
          <h2 className="h2">{t("Timeline CRM")}</h2>
          <form action={addCrmNote} className="flex flex-col gap-2 md:flex-row">
            <input type="hidden" name="user" value={p.user_id} />
            <select name="kind" className="input md:w-40"><option value="nota">{t("Nota")}</option><option value="llamada">{t("Llamada")}</option><option value="concierge">{t("Concierge")}</option><option value="incidencia">{t("Incidencia")}</option></select>
            <input name="body" className="input flex-1" placeholder={t("Añadir nota…")} required />
            <button className="btn-gold">{t("Añadir")}</button>
          </form>
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-s-2 border-gold/50 ps-3 text-sm">
                <div className="text-xs text-muted">{n.created_at.slice(0, 16)} · {t(n.kind)} · {n.author}</div>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-4">
          <div className="card">
            <h2 className="h2 mb-3">{t("Verificaciones")}</h2>
            <ul className="space-y-1 text-sm">{VERIFICATION_TYPES.map((x) => <li key={x.id} className="flex justify-between"><span>{t(x.label)}</span><span className="text-muted">{t(v.map[x.id]?.status ?? "—")}</span></li>)}</ul>
          </div>
          <div className="card">
            <h2 className="h2 mb-3">{t("Ingresos por línea")}</h2>
            <ul className="space-y-1 text-sm">{byStream.map((s) => <li key={s.stream} className="flex justify-between"><span className="text-muted">{t(STREAM_LABEL[s.stream] ?? s.stream)}</span><span>{money(s.v)}</span></li>)}</ul>
          </div>
          <form action={grantCredit} className="card space-y-2">
            <h2 className="h2">{t("Crédito de cortesía")}</h2>
            <input type="hidden" name="user" value={p.user_id} />
            <input name="amount" type="number" min={1} max={10000} className="input" placeholder={t("AED")} required />
            <input name="reason" className="input" placeholder={t("Motivo")} />
            <button className="btn-ghost w-full">{t("Abonar")}</button>
          </form>
          <div className="card text-sm">
            <h2 className="h2 mb-2">{t("Intereses")}</h2>
            <div className="flex flex-wrap gap-1">{csv(p.interests).map((i) => <span key={i} className="chip">{i}</span>)}</div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Movimientos de billetera")}</h2>
          <table className="tbl"><tbody>{txs.map((x) => <tr key={x.id}><td className="text-muted">{x.created_at.slice(0, 10)}</td><td>{t.msg(x.description)}</td><td className="text-end tabular-nums">{money(x.amount)}</td></tr>)}</tbody></table>
        </section>
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-3">{t("Reservas")}</h2>
          <table className="tbl"><tbody>{bookings.map((b) => <tr key={b.id}><td>#{b.id}</td><td>{t(b.kind)}</td><td>{t(b.status)}</td><td className="text-muted">{b.start_at.slice(0, 10)}</td><td className="text-end">{money(b.total)}</td></tr>)}</tbody></table>
        </section>
      </div>
    </div>
  );
}

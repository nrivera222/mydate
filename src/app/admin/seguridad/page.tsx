import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { money } from "@/lib/money";
import { resolveDispute, resolveReport } from "../../actions/admin";
import { Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function Safety({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const reports = all<{ id: number; reason: string; details: string; status: string; created_at: string; reporter: string; reported: string; reported_id: number }>(
    `SELECT r.*, a.name AS reporter, b.name AS reported FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.reported_id
     ORDER BY r.status = 'resuelto', r.id DESC LIMIT 30`,
  );
  const disputes = all<{ id: number; client: string; provider: string; total: number; start_at: string; activity: string }>(
    `SELECT b.id, c.name AS client, p.name AS provider, b.total, b.start_at, b.activity FROM bookings b JOIN users c ON c.id = b.client_id JOIN users p ON p.id = b.provider_id
     WHERE b.status = 'disputed' ORDER BY b.id DESC`,
  );
  const live = all<{ id: number; client: string; provider: string | null; lounge: string | null; start_at: string; safety_checkin_at: string | null }>(
    `SELECT b.id, c.name AS client, p.name AS provider, l.name AS lounge, b.start_at, b.safety_checkin_at FROM bookings b JOIN users c ON c.id = b.client_id
     LEFT JOIN users p ON p.id = b.provider_id LEFT JOIN lounges l ON l.id = b.lounge_id
     WHERE b.status = 'accepted' AND datetime(b.start_at) BETWEEN datetime('now', '-1 day') AND datetime('now', '+7 days') ORDER BY b.start_at`,
  );

  return (
    <div>
      <PageHeader title={t("Confianza y seguridad")} subtitle={t("Denuncias, disputas con fondos en custodia y encuentros próximos con check-in de seguridad.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <section className="mb-8">
        <h2 className="h2 mb-3">{t("Disputas abiertas")}</h2>
        {disputes.length === 0 ? <Empty>{t("Sin disputas abiertas.")}</Empty> : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <div key={d.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-medium">#{d.id} · {t(d.activity)}</div><div className="text-sm text-muted">{d.client} → {d.provider} · {d.start_at.slice(0, 16)} · {t("{amount} en custodia", { amount: money(d.total) })}</div></div>
                <div className="flex gap-2">
                  <form action={resolveDispute}><input type="hidden" name="booking" value={d.id} /><input type="hidden" name="favor" value="client" /><button className="btn-ghost">{t("Reembolsar cliente")}</button></form>
                  <form action={resolveDispute}><input type="hidden" name="booking" value={d.id} /><input type="hidden" name="favor" value="provider" /><button className="btn-brand">{t("Pagar acompañante")}</button></form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb-8 overflow-x-auto">
        <h2 className="h2 mb-3">{t("Encuentros próximos")}</h2>
        <table className="tbl">
          <thead><tr><th>#</th><th>{t("Participantes")}</th><th>{t("Lugar")}</th><th>{t("Inicio")}</th><th>{t("Check-in")}</th></tr></thead>
          <tbody>
            {live.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td><td>{b.client}{b.provider ? ` · ${b.provider}` : ""}</td><td className="text-muted">{b.lounge ?? t("Evento del cliente")}</td>
                <td className="text-muted">{b.start_at.slice(0, 16)}</td>
                <td>{b.safety_checkin_at ? <span className="chip border-ok/40 text-ok">✓ {b.safety_checkin_at.slice(11, 16)}</span> : <span className="chip">{t("Pendiente")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2 mb-3">{t("Denuncias")}</h2>
        <table className="tbl">
          <thead><tr><th>{t("Fecha")}</th><th>{t("Denunciante")}</th><th>{t("Denunciado")}</th><th>{t("Motivo")}</th><th>{t("Detalles")}</th><th /></tr></thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{r.created_at.slice(0, 10)}</td><td>{r.reporter}</td>
                <td><Link href={`/admin/crm/${r.reported_id}`} className="text-glow">{r.reported}</Link></td>
                <td>{t(r.reason)}</td><td className="text-muted">{r.details}</td>
                <td>{r.status === "abierto" ? <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost px-3 py-1">{t("Resolver")}</button></form> : <span className="chip">{t("Resuelta")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

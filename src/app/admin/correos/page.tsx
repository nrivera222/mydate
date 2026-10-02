import { requireAdmin } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { emailEnabled } from "@/lib/email";
import { getT } from "@/lib/i18n";
import { retryEmails } from "../../actions/admin";
import { Flash, PageHeader, sp, Stat, type SP } from "@/components/ui";

const STATUS: Record<string, [string, string]> = {
  enviado: ["Enviado", "chip border-ok/40 text-ok"], demo: ["Demostración", "chip"], pendiente: ["Pendiente", "chip border-electric/50 text-electric"], error: ["Error", "chip border-rose/40 text-rose"],
};

// Registro del correo saliente del ecosistema (confirmaciones, regalos, invitaciones)
export default async function Outbox({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const rows = all<{ id: number; to_email: string; subject: string; kind: string; status: string; error: string | null; attempts: number; created_at: string; html: string }>(
    "SELECT id, to_email, subject, kind, status, error, attempts, created_at, html FROM email_outbox ORDER BY id DESC LIMIT 100",
  );
  const stats = one<{ total: number; sent: number; failed: number; optouts: number }>(
    "SELECT COUNT(*) AS total, SUM(status = 'enviado') AS sent, SUM(status IN ('error','pendiente')) AS failed, (SELECT COUNT(*) FROM email_optout) AS optouts FROM email_outbox",
  )!;
  const preview = rows.find((r) => r.id === Number(sp(q.ver))) ?? rows[0];
  const enabled = emailEnabled();

  return (
    <div>
      <PageHeader title={t("Correo saliente")} subtitle={t("Confirmaciones de reserva, tarjetas regalo, cancelaciones e invitaciones. Los comerciales incluyen enlace de baja.")}>
        <form action={retryEmails}><button className="btn-ghost" type="submit">{t("Reintentar pendientes y errores")}</button></form>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      <div className={`mb-6 rounded-2xl border p-4 text-sm ${enabled ? "border-ok/40 bg-ok/10" : "border-line bg-ink-2"}`}>
        {enabled ? t("Envío real activado con Resend (RESEND_API_KEY).")
          : t("Modo demostración: los correos se registran pero no se envían. Define RESEND_API_KEY y EMAIL_FROM para enviarlos de verdad.")}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={t("Correos")} value={stats.total} />
        <Stat label={t("Enviados")} value={stats.sent ?? 0} />
        <Stat label={t("Pendientes o con error")} value={stats.failed ?? 0} />
        <Stat label={t("Bajas comerciales")} value={stats.optouts} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card overflow-x-auto lg:col-span-3">
          <table className="tbl">
            <thead><tr><th>{t("Fecha")}</th><th>{t("Para")}</th><th>{t("Asunto")}</th><th>{t("Tipo")}</th><th>{t("Estado")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={preview?.id === r.id ? "bg-brand/10" : ""}>
                  <td className="whitespace-nowrap text-muted">{r.created_at.slice(5, 16)}</td>
                  <td className="max-w-40 truncate">{r.to_email}</td>
                  <td><a className="hover:text-glow" href={`/admin/correos?ver=${r.id}`}>{r.subject}</a>{r.error && <div className="text-xs text-rose">{r.error}</div>}</td>
                  <td className="text-xs">{t(r.kind === "marketing" ? "Comercial" : "Transaccional")}</td>
                  <td><span className={STATUS[r.status]?.[1] ?? "chip"}>{t(STATUS[r.status]?.[0] ?? r.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-muted">{t("Aún no se ha enviado ningún correo.")}</p>}
        </section>
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-3">{t("Vista previa")}</h2>
          {preview ? <iframe title={preview.subject} srcDoc={preview.html} sandbox="" className="h-[560px] w-full rounded-xl border border-line bg-[#05040F]" /> : <p className="text-sm text-muted">—</p>}
        </section>
      </div>
    </div>
  );
}

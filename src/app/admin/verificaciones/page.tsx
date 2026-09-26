import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { VERIFICATION_TYPES } from "@/lib/catalog";
import { reviewVerification } from "../../actions/admin";
import { Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

type Row = { id: number; user_id: number; name: string; email: string; type: string; data: string; file_path: string | null; created_at: string; photo_path: string | null };

export default async function VerificationQueue({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  await requireAdmin();
  const q = await searchParams;
  const rows = all<Row>(
    `SELECT v.id, v.user_id, u.name, u.email, v.type, v.data, v.file_path, v.created_at, p.photo_path FROM verifications v
     JOIN users u ON u.id = v.user_id LEFT JOIN profiles p ON p.user_id = v.user_id WHERE v.status = 'pending' ORDER BY v.created_at`,
  );
  const recent = all<{ id: number; name: string; type: string; status: string; reviewed_at: string }>(
    "SELECT v.id, u.name, v.type, v.status, v.reviewed_at FROM verifications v JOIN users u ON u.id = v.user_id WHERE v.status != 'pending' AND v.reviewed_at IS NOT NULL ORDER BY v.reviewed_at DESC LIMIT 10",
  );
  const label = (id: string) => t(VERIFICATION_TYPES.find((x) => x.id === id)?.label ?? id);

  return (
    <div>
      <PageHeader title={t("Cola de verificación")} subtitle={t("Revisión manual de identidad, foto, perfil psicológico y médico. Los documentos son confidenciales: acceso auditado.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {rows.length === 0 && <Empty>{t("No hay verificaciones pendientes. 🎉")}</Empty>}
      <div className="space-y-4">
        {rows.map((r) => {
          const data = JSON.parse(r.data || "{}") as Record<string, unknown>;
          return (
            <article key={r.id} className="card grid gap-4 md:grid-cols-3">
              <div>
                <span className="chip-brand">{label(r.type)}</span>
                <div className="mt-2 font-medium"><Link href={`/admin/crm/${r.user_id}`} className="hover:text-glow">{r.name}</Link></div>
                <div className="text-sm text-muted">{r.email}</div>
                <div className="text-xs text-muted">{t("Enviado {date}", { date: r.created_at.slice(0, 16) })}</div>
              </div>
              <div className="space-y-1 text-sm">
                {Object.entries(data).filter(([k]) => k !== "traits").map(([k, v]) => (
                  <div key={k}><span className="text-muted">{k}:</span> {typeof v === "string" && v.startsWith("private/") ? <a className="text-glow underline" href={`/media/${v}`} target="_blank">{t("ver archivo")}</a> : String(v)}</div>
                ))}
                {r.file_path && <a className="text-glow underline" href={`/media/${r.file_path}`} target="_blank">{t("Abrir documento adjunto")}</a>}
                {r.type === "photo" && r.photo_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${r.photo_path}`} alt="" className="mt-2 h-32 w-32 rounded-xl object-cover" />
                )}
              </div>
              <form action={reviewVerification} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input className="input" name="notes" placeholder={t("Nota / motivo de rechazo")} maxLength={300} />
                <div className="flex gap-2">
                  <button className="btn-brand flex-1" name="decision" value="approve">{t("Aprobar")}</button>
                  <button className="btn-danger flex-1" name="decision" value="reject">{t("Rechazar")}</button>
                </div>
              </form>
            </article>
          );
        })}
      </div>
      {recent.length > 0 && (
        <section className="card mt-8">
          <h2 className="h2 mb-3">{t("Revisadas recientemente")}</h2>
          <table className="tbl">
            <thead><tr><th>{t("Miembro")}</th><th>{t("Tipo")}</th><th>{t("Resultado")}</th><th>{t("Fecha")}</th></tr></thead>
            <tbody>{recent.map((r) => <tr key={r.id}><td>{r.name}</td><td>{label(r.type)}</td><td>{r.status === "approved" ? t("✓ Aprobada") : t("✕ Rechazada")}</td><td className="text-muted">{r.reviewed_at.slice(0, 16)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}

import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getProfile, verificationStatus } from "@/lib/users";
import { INSURANCE_PLANS, PSYCH_ITEMS, TRAIT_LABELS, VERIFICATION_TYPES } from "@/lib/catalog";
import { money } from "@/lib/money";
import { uploadPhoto } from "../actions/profile";
import { submitIdentity, submitMedical, submitPsych, subscribeInsurance } from "../actions/verification";
import { Avatar, Flash, PageHeader, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

const STATUS: Record<string, [string, string]> = {
  approved: ["Aprobado", "chip-gold"],
  pending: ["En revisión", "chip border-sky-300/40 text-sky-200"],
  rejected: ["Rechazado", "chip border-rose/40 text-rose"],
};

export default async function VerificationPage({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const p = getProfile(user.id)!;
  const v = verificationStatus(user.id);
  const policy = one<{ plan: string; coverage: number; premium: number; beneficiary: string; started_at: string }>(
    "SELECT * FROM insurance_policies WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", user.id,
  );
  const traits = JSON.parse(p.traits || "{}") as Record<string, number>;
  const badge = (id: string) => {
    const row = v.map[id as keyof typeof v.map];
    if (!row) return <span className="chip">{t("Pendiente de enviar")}</span>;
    const [label, cls] = STATUS[row.status];
    const labelT = t(label);
    return <span className={cls}>{labelT}</span>;
  };
  const note = (id: string) => {
    const row = v.map[id as keyof typeof v.map];
    return row?.status === "rejected" && row.notes ? <p className="text-sm text-rose">{t("Motivo: {reason}", { reason: row.notes })}</p> : null;
  };

  return (
    <div>
      <PageHeader title={t("Verificación")} subtitle={t("Cinco pasos obligatorios para ambas categorías: citas reales y acompañamiento social. Solo se muestran insignias; los documentos son privados y cifrados.")} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      <div className="card mb-8">
        <div className="flex items-center justify-between text-sm">
          <span>{t("Progreso")}</span>
          <span className="text-gold-2">{v.approved}/{v.total}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-ink-3"><div className="h-2 rounded-full bg-gold" style={{ width: `${(v.approved / v.total) * 100}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {VERIFICATION_TYPES.map((x) => <span key={x.id} className="flex items-center gap-2 text-xs text-muted">{t(x.label)} {badge(x.id)}</span>)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <div className="flex items-center justify-between"><h2 className="h2">{t("1 · Identidad")}</h2>{badge("identity")}</div>
          {note("identity")}
          <form action={submitIdentity} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="doc_type">{t("Documento")}</label>
                <select className="input" id="doc_type" name="doc_type"><option value="Pasaporte">{t("Pasaporte")}</option><option value="Emirates ID">{t("Emirates ID")}</option><option value="DNI / ID nacional">{t("DNI / ID nacional")}</option></select>
              </div>
              <div>
                <label className="label" htmlFor="doc_country">{t("País emisor")}</label>
                <input className="input" id="doc_country" name="doc_country" required />
              </div>
              <div>
                <label className="label" htmlFor="doc_last4">{t("Últimos 4 dígitos")}</label>
                <input className="input" id="doc_last4" name="doc_last4" inputMode="numeric" maxLength={4} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="document">{t("Foto del documento (JPG/PNG/PDF)")}</label>
              <input className="input" id="document" name="document" type="file" accept="image/*,application/pdf" required />
            </div>
            <div>
              <label className="label" htmlFor="selfie">{t("Selfie sosteniendo el documento")}</label>
              <input className="input" id="selfie" name="selfie" type="file" accept="image/*" required />
            </div>
            <button className="btn-ghost" type="submit">{t("Enviar identidad")}</button>
          </form>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between"><h2 className="h2">{t("2 · Foto clara")}</h2>{badge("photo")}</div>
          {note("photo")}
          <div className="flex items-center gap-4">
            <Avatar name={user.name} hue={p.hue} photo={p.photo_path} size={80} />
            <p className="text-sm text-muted">{t("Rostro visible, buena luz, sin gafas de sol ni filtros. Se compara con tu selfie de identidad.")}</p>
          </div>
          <form action={uploadPhoto} className="space-y-3">
            <input className="input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
            <button className="btn-ghost" type="submit">{t("Subir foto")}</button>
          </form>
        </section>

        <section className="card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="h2">{t("3 · Perfil psicológico")}</h2>{badge("psychological")}</div>
          {note("psychological")}
          {Object.keys(traits).length > 0 && (
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(traits).map(([k, val]) => (
                <div key={k}>
                  <div className="text-xs text-muted">{t(TRAIT_LABELS[k] ?? k)}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-ink-3"><div className="h-1.5 rounded-full bg-gold" style={{ width: `${val * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <form action={submitPsych} className="space-y-4">
            <p className="text-sm text-muted">{t("Valora cada afirmación de 1 (nada de acuerdo) a 5 (totalmente de acuerdo). Usamos el resultado para mejorar tu compatibilidad.")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {PSYCH_ITEMS.map((item) => (
                <fieldset key={item.id} className="rounded-xl border border-line p-3">
                  <legend className="px-1 text-sm">{t(item.text)}</legend>
                  <div className="mt-1 flex gap-4">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="flex items-center gap-1 text-sm text-muted">
                        <input type="radio" className="check" name={item.id} value={n} required /> {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="professional">{t("Psicólogo/a evaluador/a o centro")}</label>
                <input className="input" id="professional" name="professional" placeholder={t("p. ej. Mindful Bond Psychology (aliado)")} />
              </div>
              <div>
                <label className="label" htmlFor="psy_certificate">{t("Informe firmado (opcional)")}</label>
                <input className="input" id="psy_certificate" name="certificate" type="file" accept="image/*,application/pdf" />
              </div>
            </div>
            <button className="btn-ghost" type="submit">{t("Enviar perfil psicológico")}</button>
          </form>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between"><h2 className="h2">{t("4 · Perfil médico")}</h2>{badge("medical")}</div>
          {note("medical")}
          <form action={submitMedical} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="clinic">{t("Clínica")}</label>
                <input className="input" id="clinic" name="clinic" placeholder={t("Serenity Wellness Clinic")} required />
              </div>
              <div>
                <label className="label" htmlFor="exam_date">{t("Fecha del examen")}</label>
                <input className="input" id="exam_date" name="exam_date" type="date" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="med_certificate">{t("Certificado médico (< 6 meses)")}</label>
              <input className="input" id="med_certificate" name="certificate" type="file" accept="image/*,application/pdf" required />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" className="check mt-1" name="declaration" />{" "}{t("Declaro que la información es veraz y que no padezco enfermedades transmisibles que pongan en riesgo a terceros.")}
            </label>
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" className="check mt-1" name="consent" />{" "}{t("Consiento el tratamiento de datos de salud únicamente para emitir la insignia de verificación.")}
            </label>
            <button className="btn-ghost" type="submit">{t("Enviar certificado")}</button>
          </form>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between"><h2 className="h2">{t("5 · Seguro de vida")}</h2>{badge("insurance")}</div>
          {policy ? (
            <div className="rounded-xl border border-gold/30 p-4 text-sm">
              <div className="text-gold-2">{t(INSURANCE_PLANS.find((x) => x.id === policy.plan)?.label ?? policy.plan)}</div>
              <div className="mt-1 text-muted">{t("Cobertura {c} · Prima {p}/mes · Beneficiario: {b}", { c: money(policy.coverage), p: money(policy.premium), b: policy.beneficiary })}</div>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("Obligatorio para todos los miembros. Póliza emitida por nuestro aliado asegurador; la primera prima se cobra de tu billetera.")}</p>
          )}
          <form action={subscribeInsurance} className="space-y-3">
            <div className="grid gap-2">
              {INSURANCE_PLANS.map((pl) => (
                <label key={pl.id} className="flex items-center justify-between rounded-xl border border-line p-3 text-sm has-[:checked]:border-gold">
                  <span className="flex items-center gap-2"><input type="radio" className="check" name="plan" value={pl.id} defaultChecked={pl.id === "premium"} /> {t(pl.label)}</span>
                  <span className="text-muted">{t("Cobertura {c}", { c: money(pl.coverage) })} · <span className="text-gold-2">{t("{price}/mes", { price: money(pl.premium) })}</span></span>
                </label>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="beneficiary">{t("Beneficiario")}</label>
              <input className="input" id="beneficiary" name="beneficiary" placeholder={t("Nombre y parentesco")} required />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" className="check mt-1" name="accept" />{" "}{t("Acepto las condiciones generales y particulares de la póliza de vida.")}
            </label>
            <button className="btn-gold" type="submit">{policy ? t("Cambiar póliza") : t("Contratar seguro")}</button>
          </form>
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { PARK_ZONES, SURVEY, productById } from "@/lib/park-catalog";
import { submitSurvey } from "../../actions/park";
import { Flash, sp, type SP } from "@/components/ui";

// Encuesta pública de validación: sin cuenta, anónima salvo que se deje un email (solo mayores de 18)
export default async function Survey({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const q = await searchParams;
  const completa = productById("completa")!;
  const radios = (name: string, options: string[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => (
        <label key={o} className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/15">
          <input className="sr-only" type="radio" name={name} value={i} required /> {t(o)}
        </label>
      ))}
    </div>
  );
  if (sp(q.gracias)) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="text-6xl">💞</div>
        <h1 className="h1 mt-4">{t("¡Gracias por responder!")}</h1>
        <p className="mt-3 text-muted">{t("Con tus respuestas diseñamos el primer parque de citas de Chile.")}</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/park" className="btn-brand">{t("Conocer TWO LOVE Park")}</Link></div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <p className="chip-brand">TWO LOVE Park · {t("Santiago de Chile")}</p>
      <h1 className="h1 mt-3">{t("¿Cómo son vuestras citas?")}</h1>
      <p className="mt-2 text-muted">{t("Dos minutos, anónima. Nos ayuda a decidir qué experiencias tendrá el parque de citas.")}</p>
      <div className="mt-6"><Flash ok={sp(q.ok)} error={sp(q.error)} /></div>
      <form action={submitSurvey} className="card mt-2 space-y-6">
        <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <fieldset><legend className="label">{t("Tu edad")}</legend>{radios("age", SURVEY.ages)}</fieldset>
        <fieldset><legend className="label">{t("¿Cuánto tiempo lleváis juntos?")}</legend>{radios("together", SURVEY.together)}</fieldset>
        <fieldset><legend className="label">{t("¿Cuántas citas tenéis al mes?")}</legend>{radios("frequency", SURVEY.frequency)}</fieldset>
        <fieldset><legend className="label">{t("¿Cuánto gastáis por cita, entre los dos?")}</legend>{radios("spend", SURVEY.spend)}</fieldset>
        <fieldset>
          <legend className="label">{t("¿Qué os gustaría hacer? (varias)")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PARK_ZONES.map((z) => (
              <label key={z.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-checked:border-brand has-checked:bg-brand/10">
                <input className="check mt-1" type="checkbox" name="interests" value={z.id} /><span><b>{z.icon} {t(z.name)}</b><br /><span className="text-muted">{t(z.desc)}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">{t("¿Pagaríais {price} por la Cita Completa?", { price: clp(completa.price) })}</legend>
          <p className="mb-2 text-xs text-muted">{completa.includes.map((i) => t(i)).join(" · ")}</p>
          {radios("pay", SURVEY.answers)}
        </fieldset>
        <fieldset>
          <legend className="label">{t("¿Qué fechas celebráis?")}</legend>
          <div className="flex flex-wrap gap-2">
            {SURVEY.dates.map((d) => (
              <label key={d} className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/15">
                <input className="sr-only" type="checkbox" name="dates" value={d} /> {t(productById(d)?.name ?? d)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset><legend className="label">{t("¿Os uniríais a un club de parejas por CLP 7.900 al mes?")}</legend>{radios("club", SURVEY.answers)}</fieldset>
        <div>
          <label className="label" htmlFor="comuna">{t("Comuna (opcional)")}</label>
          <input className="input" id="comuna" name="comuna" maxLength={60} placeholder="Providencia" />
        </div>
        <div className="space-y-2 rounded-xl border border-line p-4">
          <label className="label" htmlFor="email">{t("Email para invitaros al pop-up (opcional, solo mayores de 18)")}</label>
          <input className="input" id="email" name="email" type="email" maxLength={160} />
          <label className="flex items-start gap-2 text-xs text-muted"><input className="check mt-0.5" type="checkbox" name="consent" /> {t("Acepto que TWO LOVE me escriba para invitarme al pop-up de prueba. Puedo darme de baja cuando quiera.")}</label>
        </div>
        <button className="btn-brand w-full" type="submit">{t("Enviar respuestas")}</button>
      </form>
    </div>
  );
}

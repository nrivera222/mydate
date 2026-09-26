import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getProfile, csv, verificationStatus } from "@/lib/users";
import { ARCHETYPES, CITIES, COMPANION_ACTIVITIES, COMPANION_RULES, GENDERS, INTENTS, INTERESTS, LANGUAGES, NET_WORTH, RATE_UNITS, tierById } from "@/lib/catalog";
import { saveCompanionOffer, saveProfile } from "../../actions/profile";
import { Flash, PageHeader, sp, VerifiedBadge, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function EditProfile({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const p = getProfile(user.id)!;
  const v = verificationStatus(user.id);
  const offer = one<Record<string, number | string | null>>("SELECT * FROM companion_offers WHERE user_id = ?", user.id);
  const tier = tierById(user.tier);
  const seeking = csv(p.seeking), interests = csv(p.interests), languages = csv(p.languages), activities = csv(offer?.activities as string);

  return (
    <div>
      <PageHeader title={t("Mi perfil")} subtitle={t("Tu perfil define con quién conectas. Cuanto más completo, mejor compatibilidad.")}>
        <div className="flex items-center gap-3">
          <VerifiedBadge count={v.approved} />
          <Link href={`/perfil/${user.id}`} className="btn-ghost">{t("Ver perfil público")}</Link>
        </div>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {!v.complete && (
        <div className="card mb-6 border-brand/40">
          <p className="text-sm">{t("Te faltan {n} verificaciones para aparecer en TWO LOVE.", { n: v.total - v.approved })} <Link href="/verificacion" className="text-glow underline">{t("Completar verificación →")}</Link></p>
        </div>
      )}

      <form action={saveProfile} className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-4 lg:col-span-2">
          <h2 className="h2">{t("Sobre ti")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="gender">{t("Soy")}</label>
              <select className="input" id="gender" name="gender" defaultValue={p.gender} required>
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g.id} value={g.id}>{t(g.label)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="birth_year">{t("Año de nacimiento")}</label>
              <input className="input" id="birth_year" name="birth_year" type="number" defaultValue={p.birth_year ?? ""} required />
            </div>
            <div>
              <label className="label" htmlFor="nationality">{t("Nacionalidad")}</label>
              <input className="input" id="nationality" name="nationality" defaultValue={p.nationality} />
            </div>
            <div>
              <label className="label" htmlFor="city">{t("Ciudad")}</label>
              <select className="input" id="city" name="city" defaultValue={p.city} required>
                <option value="">—</option>
                {CITIES.map((c) => <option key={c.city} value={c.city}>{t(c.city)} · {t(c.country)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="archetype">{t("Prototipo")}</label>
              <select className="input" id="archetype" name="archetype" defaultValue={p.archetype}>
                <option value="">—</option>
                {ARCHETYPES.map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="net_worth">{t("Patrimonio (opcional)")}</label>
              <select className="input" id="net_worth" name="net_worth" defaultValue={p.net_worth}>
                {NET_WORTH.map((n) => <option key={n.id} value={n.id}>{t(n.label)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="occupation">{t("Ocupación")}</label>
            <input className="input" id="occupation" name="occupation" defaultValue={p.occupation} placeholder={t("p. ej. Fundadora de grupo hotelero")} />
          </div>
          <div>
            <label className="label" htmlFor="bio">{t("Biografía")}</label>
            <textarea className="input min-h-28" id="bio" name="bio" defaultValue={p.bio} maxLength={800} />
          </div>
          <fieldset>
            <legend className="label">{t("Idiomas")}</legend>
            <div className="flex flex-wrap gap-3">
              {LANGUAGES.map((l) => (
                <label key={l} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="check" name="languages" value={l} defaultChecked={languages.includes(l)} /> {t(l)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">{t("Intereses (máx. 10)")}</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <label key={i} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:text-glow">
                  <input type="checkbox" className="sr-only" name="interests" value={i} defaultChecked={interests.includes(i)} /> {t(i)}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card space-y-4">
          <h2 className="h2">{t("Qué buscas")}</h2>
          <fieldset>
            <legend className="label">{t("Me interesan")}</legend>
            <div className="flex flex-wrap gap-3">
              {GENDERS.map((g) => (
                <label key={g.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="check" name="seeking" value={g.id} defaultChecked={seeking.includes(g.id)} /> {t(g.label)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="intent">{t("Intención")}</label>
            <select className="input" id="intent" name="intent" defaultValue={p.intent}>
              {INTENTS.map((i) => <option key={i.id} value={i.id}>{t(i.label)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="age_min">{t("Edad mín.")}</label>
              <input className="input" id="age_min" name="age_min" type="number" min={21} max={90} defaultValue={p.age_min} />
            </div>
            <div>
              <label className="label" htmlFor="age_max">{t("Edad máx.")}</label>
              <input className="input" id="age_max" name="age_max" type="number" min={21} max={90} defaultValue={p.age_max} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="check" name="real_dating" defaultChecked={!!p.real_dating} />{" "}{t("Mostrarme en citas reales")}
          </label>
          <label className={`flex items-center gap-2 text-sm ${tier.incognito ? "" : "opacity-50"}`}>
            <input type="checkbox" className="check" name="incognito" defaultChecked={!!p.incognito} disabled={!tier.incognito} />
            {t("Modo incógnito")} {!tier.incognito && <span className="chip">{t("Platinum+")}</span>}
          </label>
          <p className="text-xs text-muted">{t("En modo incógnito solo te ven las personas a las que das like.")}</p>
          <button className="btn-brand w-full" type="submit">{t("Guardar perfil")}</button>
        </section>
      </form>

      <form id="acompanamiento" action={saveCompanionOffer} className="card mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="h2">{t("Ofrecer acompañamiento social")}</h2>
            <p className="text-sm text-muted">{t("Alquila tu tiempo como acompañante para eventos, galas o viajes. TWO LOVE retiene un 15% de comisión.")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="check" name="enabled" defaultChecked={!!p.companion_provider} />{" "}{t("Oferta activa")}
          </label>
        </div>
        <div>
          <label className="label" htmlFor="headline">{t("Titular")}</label>
          <input className="input" id="headline" name="headline" defaultValue={(offer?.headline as string) ?? ""} placeholder={t("p. ej. Acompañante de gala políglota")} />
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {RATE_UNITS.map((u) => (
            <div key={u.id}>
              <label className="label" htmlFor={`rate_${u.id}`}>{t(u.per)} (AED)</label>
              <input className="input" id={`rate_${u.id}`} name={`rate_${u.id}`} type="number" min={0} step="1"
                defaultValue={offer?.[`rate_${u.id}`] ? Number(offer[`rate_${u.id}`]) / 100 : ""} />
            </div>
          ))}
        </div>
        <fieldset>
          <legend className="label">{t("Actividades")}</legend>
          <div className="flex flex-wrap gap-2">
            {COMPANION_ACTIVITIES.map((a) => (
              <label key={a} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:text-glow">
                <input type="checkbox" className="sr-only" name="activities" value={a} defaultChecked={activities.includes(a)} /> {t(a)}
              </label>
            ))}
          </div>
        </fieldset>
        <ul className="list-disc space-y-1 ps-5 text-xs text-muted">
          {COMPANION_RULES.map((r) => <li key={r}>{t(r)}</li>)}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="check" name="rules" />{" "}{t("Acepto el código de acompañamiento social")}
        </label>
        <button className="btn-brand" type="submit">{t("Guardar oferta")}</button>
      </form>
    </div>
  );
}

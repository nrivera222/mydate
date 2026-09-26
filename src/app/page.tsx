import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { ARCHETYPES, RATE_UNITS, TIERS, VERIFICATION_TYPES } from "@/lib/catalog";
import { money } from "@/lib/money";
import { getT } from "@/lib/i18n";

export default async function Home() {
  const t = await getT();
  const user = await currentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/descubrir");

  const stats = one<{ members: number; cities: number; lounges: number }>(
    "SELECT (SELECT COUNT(*) FROM users WHERE role = 'user') AS members, (SELECT COUNT(DISTINCT city) FROM profiles WHERE city != '') AS cities, (SELECT COUNT(*) FROM lounges) AS lounges",
  )!;
  const lounges = all<{ id: number; name: string; city: string; kind: string; description: string }>("SELECT id, name, city, kind, description FROM lounges LIMIT 3");
  const partners = all<{ name: string; category: string }>("SELECT name, category FROM partners");

  return (
    <div className="space-y-24">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,75,0.25),transparent_60%)] px-6 py-20 md:px-14">
        <LogoMark size={360} className="pointer-events-none absolute end-10 top-1/2 hidden -translate-y-1/2 lg:block" />
        <p className="chip-gold mb-6">{t("Dubái · Global · Solo por verificación")}</p>
        <h1 className="max-w-3xl font-display text-5xl leading-tight md:text-6xl">
          {t("El amor también merece")}{" "}<span className="gold-text">{t("excelencia")}</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          {t("TWO LOVE conecta a empresarios, herederos, ejecutivos y figuras de alto perfil que buscan pareja o matrimonio — y ofrece acompañamiento social verificado para eventos, viajes y galas. Todo en un entorno discreto, seguro y de lujo.")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/registro" className="btn-gold">{t("Solicitar acceso")}</Link>
          <Link href="/entrar" className="btn-ghost">{t("Ya soy miembro")}</Link>
        </div>
        <div className="mt-14 grid max-w-xl grid-cols-3 gap-6 text-center">
          <div><div className="font-display text-3xl text-gold-2">{stats.members}+</div><div className="text-xs text-muted">{t("miembros verificados")}</div></div>
          <div><div className="font-display text-3xl text-gold-2">{stats.cities}</div><div className="text-xs text-muted">{t("ciudades")}</div></div>
          <div><div className="font-display text-3xl text-gold-2">{stats.lounges}</div><div className="text-xs text-muted">{t("Salas TWO LOVE")}</div></div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-8">
          <div className="chip-gold">{t("Categoría 1")}</div>
          <h2 className="mt-4 font-display text-3xl">{t("Citas reales")}</h2>
          <p className="mt-3 text-muted">
            {t("Encuentra novio, novia, esposo o esposa según tu género, preferencias, prototipo internacional, intereses y personalidad. Nuestro algoritmo combina intereses, test psicológico, idiomas, ciudad e intención.")}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {ARCHETYPES.slice(0, 6).map((a) => <li key={a.id} className="chip">{t(a.label)}</li>)}
          </ul>
        </div>
        <div className="card p-8">
          <div className="chip-gold">{t("Categoría 2")}</div>
          <h2 className="mt-4 font-display text-3xl">{t("Acompañamiento social")}</h2>
          <p className="mt-3 text-muted">
            {t("Las «citas de compañía»: reserva un acompañante verificado por hora, día, semana, mes o año para galas, bodas, eventos corporativos o viajes. Estrictamente social y platónico, con pago en custodia.")}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {RATE_UNITS.map((u) => <li key={u.id} className="chip">{t(u.per)}</li>)}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">{t("5 niveles de verificación")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">{t("Ningún perfil interactúa sin completarlos. Solo mostramos insignias: tus datos médicos y psicológicos nunca son públicos.")}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {VERIFICATION_TYPES.map((v, i) => (
            <div key={v.id} className="card">
              <div className="font-display text-3xl text-gold">0{i + 1}</div>
              <div className="mt-2 font-medium">{t(v.label)}</div>
              <p className="mt-1 text-sm text-muted">{t(v.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">{t("Salas TWO LOVE")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">{t("Recintos de la marca diseñados para citas: rooftops, yates, majlis en el desierto y suites privadas.")}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {lounges.map((l) => (
            <div key={l.id} className="card">
              <div className="chip">{t(l.city)}</div>
              <div className="mt-3 font-display text-xl" dir="ltr">{l.name}</div>
              <p className="mt-2 text-sm text-muted">{t(l.description)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">{t("Membresías")}</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {TIERS.map((x) => (
            <div key={x.id} className={`card ${x.id === "royal" ? "border-gold" : ""}`}>
              <div className="font-display text-xl">{x.name}</div>
              <div className="mt-1 text-gold-2">{x.monthly ? t("{price}/mes", { price: money(x.monthly) }) : t("Gratis")}</div>
              <p className="mt-3 text-sm text-muted">{t(x.tagline)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8">
        <h2 className="h2">{t("Alianzas de marca")}</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {partners.map((p) => <span key={p.name} className="chip">{p.name}</span>)}
        </div>
      </section>
    </div>
  );
}

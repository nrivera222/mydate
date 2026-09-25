import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { ARCHETYPES, TIERS, VERIFICATION_TYPES } from "@/lib/catalog";
import { money } from "@/lib/money";

export default async function Home() {
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
        <p className="chip-gold mb-6">Dubái · Global · Solo por verificación</p>
        <h1 className="max-w-3xl font-display text-5xl leading-tight md:text-6xl">
          El amor también merece <span className="gold-text">excelencia</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          TWO LOVE conecta a empresarios, herederos, ejecutivos y figuras de alto perfil que buscan pareja o matrimonio —
          y ofrece acompañamiento social verificado para eventos, viajes y galas. Todo en un entorno discreto, seguro y de lujo.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/registro" className="btn-gold">Solicitar acceso</Link>
          <Link href="/entrar" className="btn-ghost">Ya soy miembro</Link>
        </div>
        <div className="mt-14 grid max-w-xl grid-cols-3 gap-6 text-center">
          <div><div className="font-display text-3xl text-gold-2">{stats.members}+</div><div className="text-xs text-muted">miembros verificados</div></div>
          <div><div className="font-display text-3xl text-gold-2">{stats.cities}</div><div className="text-xs text-muted">ciudades</div></div>
          <div><div className="font-display text-3xl text-gold-2">{stats.lounges}</div><div className="text-xs text-muted">Salas TWO LOVE</div></div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-8">
          <div className="chip-gold">Categoría 1</div>
          <h2 className="mt-4 font-display text-3xl">Citas reales</h2>
          <p className="mt-3 text-muted">
            Encuentra novio, novia, esposo o esposa según tu género, preferencias, prototipo internacional, intereses y personalidad.
            Nuestro algoritmo combina intereses, test psicológico, idiomas, ciudad e intención.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {ARCHETYPES.slice(0, 6).map((a) => <li key={a.id} className="chip">{a.label}</li>)}
          </ul>
        </div>
        <div className="card p-8">
          <div className="chip-gold">Categoría 2</div>
          <h2 className="mt-4 font-display text-3xl">Acompañamiento social</h2>
          <p className="mt-3 text-muted">
            Las &laquo;citas de compañía&raquo;: reserva un acompañante verificado por hora, día, semana, mes o año para galas, bodas,
            eventos corporativos o viajes. Estrictamente social y platónico, con pago en custodia.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {["Hora", "Día", "Semana", "Mes", "Año"].map((u) => <li key={u} className="chip">Por {u.toLowerCase()}</li>)}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">5 niveles de verificación</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Ningún perfil interactúa sin completarlos. Solo mostramos insignias: tus datos médicos y psicológicos nunca son públicos.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {VERIFICATION_TYPES.map((v, i) => (
            <div key={v.id} className="card">
              <div className="font-display text-3xl text-gold">0{i + 1}</div>
              <div className="mt-2 font-medium">{v.label}</div>
              <p className="mt-1 text-sm text-muted">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">Salas TWO LOVE</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Recintos de la marca diseñados para citas: rooftops, yates, majlis en el desierto y suites privadas.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {lounges.map((l) => (
            <div key={l.id} className="card">
              <div className="chip">{l.city}</div>
              <div className="mt-3 font-display text-xl">{l.name}</div>
              <p className="mt-2 text-sm text-muted">{l.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">Membresías</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {TIERS.map((t) => (
            <div key={t.id} className={`card ${t.id === "royal" ? "border-gold" : ""}`}>
              <div className="font-display text-xl">{t.name}</div>
              <div className="mt-1 text-gold-2">{t.monthly ? `${money(t.monthly)}/mes` : "Gratis"}</div>
              <p className="mt-3 text-sm text-muted">{t.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8">
        <h2 className="h2">Alianzas de marca</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {partners.map((p) => <span key={p.name} className="chip">{p.name}</span>)}
        </div>
      </section>
    </div>
  );
}

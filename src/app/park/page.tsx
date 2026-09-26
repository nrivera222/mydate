import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { tierById, TIERS } from "@/lib/catalog";
import { CLUB, PARK_PRODUCTS, PARK_ZONES, SEGMENTS, STAMPS } from "@/lib/park-catalog";
import { ParkNav } from "@/components/ParkNav";

export default async function ParkHome() {
  const t = await getT();
  const user = await currentUser();
  const venues = all<{ id: number; name: string; city: string; size_m2: number; status: string; opens_on: string; address: string }>("SELECT * FROM park_venues ORDER BY id");
  const citas = PARK_PRODUCTS.filter((p) => p.kind === "cita");
  const paquetes = PARK_PRODUCTS.filter((p) => p.kind === "paquete");
  const talleres = PARK_PRODUCTS.filter((p) => p.kind === "taller");
  const discountTiers = TIERS.filter((x) => x.giftDiscount > 0);

  return (
    <div className="space-y-20">
      {user && <ParkNav active="/park" />}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_80%_20%,rgba(192,38,211,0.25),transparent_55%),radial-gradient(ellipse_at_10%_90%,rgba(56,189,248,0.18),transparent_50%)] px-6 py-16 md:px-14">
        <p className="chip-brand mb-6">{t("Nuevo · Santiago de Chile")}</p>
        <h1 className="max-w-3xl font-display text-4xl leading-tight md:text-6xl">
          {t("TWO LOVE Park:")} <span className="brand-text">{t("el parque de citas")}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          {t("Café, escenarios inmersivos, juegos, cabinas de fotos y máquinas para parejas de todas las edades. La cita deja de ser «lo mismo de siempre» y se convierte en una experiencia que se vive y se recuerda.")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/park/reservar" className="btn-brand">{t("Reservar una cita")}</Link>
          <Link href={user ? "/park/pasaporte" : "/registro"} className="btn-ghost">{user ? t("Mi pasaporte del amor") : t("Crear cuenta")}</Link>
        </div>
        <p className="mt-6 text-xs text-muted">{t("Una sola cuenta TWO LOVE: la misma billetera, notificaciones y membresía en Dubái y en el Park.")}</p>
      </section>

      <section>
        <h2 className="h1 text-center">{t("Un parque de citas bajo un techo")}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARK_ZONES.map((z) => (
            <div key={z.id} className="card">
              <div className="text-3xl">{z.icon}</div>
              <div className="mt-3 font-display text-xl">{t(z.name)}</div>
              <p className="mt-1 text-sm text-muted">{t(z.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">{t("Un menú de citas sin planificar")}</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {citas.map((p) => (
            <div key={p.id} className={`card flex flex-col ${p.badge === "Recomendada" ? "border-brand/60 shadow-[0_0_40px_rgba(139,92,246,.25)]" : ""}`}>
              {p.badge && <span className="chip-brand self-start">{t(p.badge)}</span>}
              <div className="mt-3 font-display text-2xl">{t(p.name)}</div>
              <div className="mt-1 text-3xl font-semibold text-glow">{clp(p.price)}<span className="text-sm font-normal text-muted"> {t("por pareja")}</span></div>
              <ul className="mt-4 flex-1 space-y-1 text-sm text-muted">{p.includes.map((i) => <li key={i}>✦ {t(i)}</li>)}</ul>
              <Link href={`/park/reservar?p=${p.id}`} className="btn-brand mt-6">{t("Reservar")}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2">{t("Fechas especiales")}</h2>
          <table className="tbl mt-4">
            <tbody>
              {paquetes.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/park/reservar?p=${p.id}`} className="hover:text-glow">{t(p.name)}</Link><div className="text-xs text-muted">{p.includes.map((i) => t(i)).join(" · ")}</div></td>
                  <td className="whitespace-nowrap text-end text-glow">{p.from ? `${t("desde")} ` : ""}{clp(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{t("Anticipo del 30 % al reservar; el resto se paga al llegar, con QR o desde tu billetera.")}</p>
        </div>
        <div className="card">
          <h2 className="h2">{t("Talleres")}</h2>
          <table className="tbl mt-4">
            <tbody>
              {talleres.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/park/reservar?p=${p.id}`} className="hover:text-glow">{t(p.name)}</Link><div className="text-xs text-muted">{p.includes.map((i) => t(i)).join(" · ")}</div></td>
                  <td className="whitespace-nowrap text-end text-glow">{clp(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="h2">{t("Pasaporte del amor")}</h2>
          <p className="mt-2 text-sm text-muted">{t("Seis sellos, uno por experiencia. Completadlo y os regalamos una Cita Clásica.")}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {STAMPS.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand/40 p-3 text-center">
                <span className="text-3xl">{s.icon}</span><span className="text-xs text-muted">{t(s.label)}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted">{t("Contador de días de pololeo con recordatorios de cumplemes, día 100, día 200 y aniversario.")}</p>
        </div>
        <div className="card border-brand/50">
          <h2 className="h2">{t("Two Love Club")}</h2>
          <div className="mt-2 text-3xl font-semibold text-glow">{clp(CLUB.price)}<span className="text-sm font-normal text-muted"> {t("al mes por pareja")}</span></div>
          <ul className="mt-4 space-y-1 text-sm text-muted">{CLUB.benefits.map((b) => <li key={b}>✦ {t(b)}</li>)}</ul>
          <p className="mt-4 text-xs text-muted">{t("Incluido en las membresías {a} y {b}.", { a: tierById("diamond").name, b: tierById("royal").name })}</p>
        </div>
      </section>

      <section className="card">
        <h2 className="h2">{t("Un solo ecosistema")}</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-3 text-sm">
          <div><div className="text-glow">{t("Una cuenta, una billetera")}</div><p className="mt-1 text-muted">{t("Paga el Park con el saldo de TWO LOVE: se convierte de AED a CLP al tipo de referencia.")}</p></div>
          <div><div className="text-glow">{t("Tu membresía cuenta")}</div><p className="mt-1 text-muted">{discountTiers.map((x) => `${x.name} ${Math.round(x.giftDiscount * 100)} %`).join(" · ")} {t("de descuento en citas, paquetes y talleres.")}</p></div>
          <div><div className="text-glow">{t("De match a cita")}</div><p className="mt-1 text-muted">{t("Invita a un match de TWO LOVE a una cita en el Park y compartid el pasaporte y el contador de días.")}</p></div>
        </div>
      </section>

      <section>
        <h2 className="h1 text-center">{t("Todas las edades, un mismo local")}</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {SEGMENTS.map((s) => (
            <div key={s.id} className="card text-center">
              <div className="font-display text-2xl text-glow">{t(s.range)}</div>
              <p className="mt-2 text-sm text-muted">{t(s.note)}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted">{t("Abierto a parejas de cualquier género. Las parejas de 14 a 17 años reservan a través de su tutor: solo de día, sin alcohol, en zonas visibles y sin fotos.")}</p>
      </section>

      <section>
        <h2 className="h2">{t("Locales")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {venues.map((v) => (
            <div key={v.id} className="card">
              <span className={v.status === "abierto" ? "chip-brand" : "chip"}>{v.status === "abierto" ? t("Abierto") : t("Próximamente")}</span>
              <div className="mt-3 font-display text-xl">{v.name}</div>
              <p className="text-sm text-muted">{t(v.city)} · {v.size_m2} m²{v.address ? ` · ${v.address}` : ""}</p>
              {v.status !== "abierto" && <p className="mt-1 text-xs text-muted">{t("Apertura prevista: {date}", { date: v.opens_on.slice(0, 7) })}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

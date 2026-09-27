import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp, money } from "@/lib/money";
import { walletBalance } from "@/lib/users";
import { clpPerAed } from "@/lib/settings";
import { PARK_PRODUCTS, PRODUCT_KIND_LABEL, VOUCHER_MONTHS, clpToFils, productById, type ParkProductKind } from "@/lib/park-catalog";
import { parkDiscount, type Voucher } from "@/lib/park";
import { buyVoucher } from "../../actions/park";
import { Flash, PageHeader, sp, type SP } from "@/components/ui";
import { ParkNav } from "@/components/ParkNav";

const STATUS = { activo: "Disponible", canjeado: "Canjeado" } as Record<string, string>;

export default async function GiftADate({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser({ park: true });
  const q = await searchParams;
  const selected = productById(sp(q.p) ?? "") ?? PARK_PRODUCTS[1];
  const { rate } = parkDiscount(user.id, user.tier);
  const price = selected.price - Math.round(selected.price * rate);
  const sent = all<Voucher>("SELECT * FROM park_vouchers WHERE buyer_id = ? ORDER BY id DESC LIMIT 30", user.id);
  const received = all<Voucher & { buyer: string }>(
    "SELECT v.*, u.name AS buyer FROM park_vouchers v JOIN users u ON u.id = v.buyer_id WHERE v.recipient_email = ? AND v.buyer_id != ? ORDER BY v.id DESC", user.email.toLowerCase(), user.id,
  );
  const kinds: ParkProductKind[] = ["cita", "paquete", "taller"];
  const expired = (v: Voucher) => v.status === "activo" && v.expires_at < new Date().toISOString().replace("T", " ").slice(0, 19);

  return (
    <div>
      <ParkNav active="/park/regalar" />
      <PageHeader title={t("Regala una cita")} subtitle={t("Una tarjeta regalo para vivir una experiencia en TWO LOVE Park. Vale {n} meses y cubre la experiencia completa.", { n: VOUCHER_MONTHS })} />
      <Flash ok={sp(q.ok)} error={sp(q.error)} />

      {received.length > 0 && (
        <section className="card mb-6 border-brand/50">
          <h2 className="h2">🎁 {t("Regalos para ti")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {received.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <span><b>{t(productById(v.product)?.name ?? v.product)}</b> · {t("de {name}", { name: v.buyer.split(" ")[0] })}{v.message ? <span className="text-muted"> · «{v.message}»</span> : null}</span>
                {v.status === "activo" && !expired(v)
                  ? <Link className="btn-brand px-4 py-1.5 text-xs" href={`/park/reservar?p=${v.product}&v=${v.code}`}>{t("Reservar con mi regalo")}</Link>
                  : <span className="chip">{t(STATUS[v.status] ?? v.status)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {kinds.map((k) => (
            <div key={k}>
              <div className="label">{t(PRODUCT_KIND_LABEL[k])}</div>
              <div className="flex flex-wrap gap-2">
                {PARK_PRODUCTS.filter((p) => p.kind === k && !p.from).map((p) => (
                  <Link key={p.id} href={`/park/regalar?p=${p.id}`} className={p.id === selected.id ? "chip-brand px-3 py-1 text-sm" : "chip px-3 py-1 text-sm hover:text-glow"}>
                    {t(p.name)} · {clp(p.price)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="card bg-[radial-gradient(ellipse_at_85%_10%,rgba(192,38,211,0.25),transparent_55%)]">
            <div className="text-xs uppercase tracking-[0.3em] text-muted">TWO LOVE Park · {t("Tarjeta regalo")}</div>
            <div className="mt-3 font-display text-3xl">{t(selected.name)}</div>
            <ul className="mt-3 space-y-1 text-sm text-muted">{selected.includes.map((i) => <li key={i}>✦ {t(i)}</li>)}</ul>
          </div>
        </div>
        <aside className="lg:col-span-2">
          <form action={buyVoucher} className="card sticky top-32 space-y-4">
            <input type="hidden" name="product" value={selected.id} />
            <div>
              <label className="label" htmlFor="recipient_name">{t("Para")}</label>
              <input className="input" id="recipient_name" name="recipient_name" maxLength={60} required placeholder={t("Nombre de quien lo recibe")} />
            </div>
            <div>
              <label className="label" htmlFor="recipient_email">{t("Email (opcional)")}</label>
              <input className="input" id="recipient_email" name="recipient_email" type="email" maxLength={160} />
              <p className="mt-1 text-xs text-muted">{t("Si tiene cuenta TWO LOVE, le avisamos con el enlace para canjearlo.")}</p>
            </div>
            <div>
              <label className="label" htmlFor="message">{t("Mensaje")}</label>
              <textarea className="input" id="message" name="message" maxLength={300} placeholder={t("Feliz cumplemes 💞")} />
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-sm font-semibold">
              <span>{t("Total")}</span><span>{clp(price)} ≈ {money(clpToFils(price, clpPerAed()))}</span>
            </div>
            <p className="text-xs text-muted">{t("Saldo: {amount}.", { amount: money(walletBalance(user.id).balance) })}</p>
            <button className="btn-brand w-full" type="submit">{t("Comprar tarjeta regalo")}</button>
          </form>
        </aside>
      </div>

      {sent.length > 0 && (
        <section className="card mt-8 overflow-x-auto">
          <h2 className="h2">{t("Regalos que has hecho")}</h2>
          <table className="tbl mt-3">
            <thead><tr><th>{t("Código")}</th><th>{t("Experiencia")}</th><th>{t("Para")}</th><th>{t("Importe")}</th><th>{t("Estado")}</th><th>{t("Vence")}</th></tr></thead>
            <tbody>
              {sent.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono">{v.code}</td>
                  <td>{t(productById(v.product)?.name ?? v.product)}</td>
                  <td>{v.recipient_name}</td>
                  <td>{clp(v.amount)}</td>
                  <td><span className={v.status === "activo" ? "chip-brand" : "chip"}>{expired(v) ? t("Caducado") : t(STATUS[v.status] ?? v.status)}</span></td>
                  <td className="text-muted">{v.expires_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

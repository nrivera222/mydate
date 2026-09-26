import Link from "next/link";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { clp } from "@/lib/money";
import { productById, stampById } from "@/lib/park-catalog";
import type { ParkBooking } from "@/lib/park";
import { cancelPark } from "../../actions/park";
import { Empty, Flash, PageHeader, sp, type SP } from "@/components/ui";
import { ParkNav } from "@/components/ParkNav";

const STATUS = { reservada: "Reservada", en_curso: "En curso", completada: "Completada", cancelada: "Cancelada", no_show: "No presentada" } as Record<string, string>;

export default async function MyParkDates({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const user = await requireUser();
  const q = await searchParams;
  const rows = all<ParkBooking & { owner: string; venue: string; photos: number }>(
    `SELECT b.*, u.name AS owner, v.name AS venue, (SELECT COUNT(*) FROM park_photos f WHERE f.booking_id = b.id) AS photos
     FROM park_bookings b JOIN users u ON u.id = b.user_id JOIN park_venues v ON v.id = b.venue_id
     WHERE b.user_id = ? OR b.partner_id = ? ORDER BY b.status IN ('reservada','en_curso') DESC, CASE WHEN b.status IN ('reservada','en_curso') THEN b.slot_at END ASC, b.slot_at DESC LIMIT 60`, user.id, user.id,
  );
  const upcoming = rows.filter((b) => ["reservada", "en_curso"].includes(b.status));
  const past = rows.filter((b) => !["reservada", "en_curso"].includes(b.status));
  const qr = Object.fromEntries(await Promise.all(upcoming.map(async (b) => [b.id, await QRCode.toString(b.qr, { type: "svg", margin: 1, color: { dark: "#0B0A1F", light: "#FFFFFF" } })])));

  return (
    <div>
      <ParkNav active="/park/mis-citas" />
      <PageHeader title={t("Mis citas en TWO LOVE Park")} subtitle={t("Muestra el código QR al llegar: el equipo hace el check-in y cobra el saldo.")}>
        <Link href="/park/reservar" className="btn-brand">{t("Nueva reserva")}</Link>
      </PageHeader>
      <Flash ok={sp(q.ok)} error={sp(q.error)} />
      {upcoming.length === 0 && <Empty href="/park/reservar" cta={t("Reservar una cita")}>{t("No tienes citas próximas en el Park.")}</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {upcoming.map((b) => {
          const p = productById(b.product);
          return (
            <div key={b.id} id={`b${b.id}`} className="card flex gap-5">
              <div className="w-32 shrink-0 space-y-1 text-center">
                <div className="overflow-hidden rounded-xl bg-white p-1" dangerouslySetInnerHTML={{ __html: qr[b.id] }} />
                <div className="font-mono text-[10px] text-muted">{b.qr}</div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <span className="chip-brand">{t(STATUS[b.status] ?? b.status)}</span>
                <div className="font-display text-xl">{t(p?.name ?? b.product)}{b.destination ? ` · ${t(b.destination)}` : ""}</div>
                <div className="text-muted">{b.slot_at.slice(0, 16)} · {b.venue}</div>
                <div className="text-muted">{b.minor ? `${t("Reserva de tutor")}: ${b.minor_names}` : b.user_id === user.id ? (b.partner_name || t("Con tu pareja")) : t("Invitación de {name}", { name: b.owner.split(" ")[0] })}</div>
                <div>{t("Pagado {paid} de {total}", { paid: clp(b.paid), total: clp(b.total) })}</div>
                {b.user_id === user.id && b.status === "reservada" && (
                  <form action={cancelPark}>
                    <input type="hidden" name="booking" value={b.id} />
                    <button className="text-xs text-muted underline hover:text-rose" type="submit">{t("Cancelar reserva")}</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {past.length > 0 && (
        <div className="card mt-10">
          <h2 className="h2">{t("Historial")}</h2>
          <table className="tbl mt-4">
            <thead><tr><th>{t("Fecha")}</th><th>{t("Experiencia")}</th><th>{t("Estado")}</th><th>{t("Sellos")}</th><th>{t("Álbum")}</th></tr></thead>
            <tbody>
              {past.map((b) => {
                const p = productById(b.product);
                return (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap">{b.slot_at.slice(0, 16)}</td>
                    <td>{t(p?.name ?? b.product)}{b.destination ? ` · ${t(b.destination)}` : ""}</td>
                    <td><span className="chip">{t(STATUS[b.status] ?? b.status)}</span></td>
                    <td>{b.status === "completada" ? p?.stamps.map((s) => stampById(s)?.icon).join(" ") : "—"}</td>
                    <td>{b.album && b.photos > 0 ? <Link className="text-glow" href={`/park/album/${b.album}`}>{t("Ver fotos ({n})", { n: b.photos })}</Link> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

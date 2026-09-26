import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { ALBUM_DAYS, productById } from "@/lib/park-catalog";
import { albumByToken } from "@/lib/park";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Álbum privado de la cita (se abre escaneando el QR de la tira de fotos)
export default async function Album({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  const b = albumByToken(token);
  if (!b) notFound();
  const photos = all<{ id: number }>("SELECT id FROM park_photos WHERE booking_id = ? ORDER BY id", b.id);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="chip-brand">{b.venue}</p>
      <h1 className="h1 mt-3">{t("Vuestro álbum de TWO LOVE Park")}</h1>
      <p className="mt-2 text-muted">{t(productById(b.product)?.name ?? "")} · {b.slot_at.slice(0, 10)} · {t("Disponible {n} días desde la cita. Solo quien tenga este enlace puede verlo.", { n: ALBUM_DAYS })}</p>
      {photos.length === 0 ? <p className="card mt-8 text-muted">{t("Las fotos aún no están listas. Vuelve en unos minutos.")}</p> : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {photos.map((p) => (
            <a key={p.id} href={`/park/album/${token}/${p.id}`} download className="card overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/park/album/${token}/${p.id}`} alt={t("Foto de la cita")} className="w-full" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

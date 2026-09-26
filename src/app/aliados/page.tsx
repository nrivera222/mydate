import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { tierById } from "@/lib/catalog";
import { pct } from "@/lib/money";
import { PageHeader, TierBadge } from "@/components/ui";
import { getT } from "@/lib/i18n";

const CAT_LABEL: Record<string, string> = {
  joyeria: "Joyería", flores: "Flores", yates: "Yates", hotel: "Hoteles y resorts", aviacion: "Aviación privada", moda: "Moda",
  automocion: "Automoción", clinica: "Clínica (verificación médica)", psicologia: "Psicología (verificación)", seguros: "Seguros de vida",
  restaurante: "Restaurantes", relojeria: "Relojería",
};

export default async function Partners() {
  const t = await getT();
  const user = await requireUser();
  const rank = tierById(user.tier).rank;
  const partners = all<{ id: number; name: string; category: string; city: string; benefit: string; discount: number; min_tier: string }>(
    "SELECT * FROM partners WHERE status = 'activo' ORDER BY category, name",
  );
  return (
    <div>
      <PageHeader title={t("Aliados y beneficios")} subtitle={t("Marcas de lujo que cuidan cada detalle de tus citas. Muestra tu tarjeta digital TWO LOVE para activar el beneficio.")} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {partners.map((p) => {
          const unlocked = rank >= tierById(p.min_tier).rank;
          return (
            <div key={p.id} className={`card flex flex-col gap-3 ${unlocked ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between">
                <span className="chip">{t(CAT_LABEL[p.category] ?? p.category)}</span>
                <TierBadge tier={p.min_tier} />
              </div>
              <div className="font-display text-xl">{p.name}</div>
              <div className="text-sm text-muted">{t(p.city)}</div>
              <p className="text-sm">{t(p.benefit)}</p>
              <div className="mt-auto flex items-center justify-between">
                {p.discount > 0 && <span className="font-display text-2xl text-glow">-{pct(p.discount)}</span>}
                {unlocked ? (
                  <span className="chip-brand">{t("Código:")} <span dir="ltr">TL-{p.id.toString().padStart(3, "0")}-{user.id}</span></span>
                ) : (
                  <span className="chip">🔒 {tierById(p.min_tier).name}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

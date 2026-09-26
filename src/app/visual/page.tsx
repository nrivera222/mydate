import { PulseSphere } from "@/components/PulseSphere";
import type { SP } from "@/components/ui";

// Visual de marca a pantalla completa, sin texto ni logotipo.
// Parámetros: ?n=partículas  ?still=1 (fotograma fijo para exportar)  ?t=instante
export default async function Visual({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const n = Math.min(40000, Math.max(500, Number(q.n) || 4800));
  const still = q.still === "1";
  const t = Number(q.t) || 2.1;
  return (
    <div className="fixed inset-0 z-50 bg-[#020208]">
      <PulseSphere particles={n} still={still} time={t} />
    </div>
  );
}

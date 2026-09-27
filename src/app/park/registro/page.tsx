import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { register } from "../../actions/auth";
import { Flash, sp, type SP } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { getT } from "@/lib/i18n";

// Alta "solo Park" desde 18 años: sin acceso a citas de alto perfil ni acompañamiento (21+)
export default async function ParkRegister({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  if (await currentUser()) redirect("/park/reservar");
  const q = await searchParams;
  const year = new Date().getFullYear();
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex justify-center"><LogoMark size={88} /></div>
      <h1 className="h1 text-center">{t("Cuenta TWO LOVE Park")}</h1>
      <p className="mt-2 text-center text-muted">{t("Reserva citas, colecciona sellos y lleva vuestro contador de días. Desde 18 años.")}</p>
      <div className="card mt-8">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <form action={register} className="space-y-4">
          <input type="hidden" name="scope" value="park" />
          <div>
            <label className="label" htmlFor="name">{t("Nombre completo")}</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">{t("Email")}</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("Contraseña")}</label>
            <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="birth_year">{t("Año de nacimiento")}</label>
            <input className="input" id="birth_year" name="birth_year" type="number" min={year - 100} max={year - 18} required />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="terms" className="check mt-1" required />
            <span>{t("Soy mayor de 18 años y acepto los términos, la política de privacidad y el código de conducta de TWO LOVE Park.")}</span>
          </label>
          <button className="btn-brand w-full" type="submit">{t("Crear cuenta")}</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">{t("¿Tenéis entre 14 y 17 años? Vuestra madre, padre o tutor puede reservar por vosotros desde su cuenta.")}</p>
        <p className="mt-4 text-center text-sm text-muted">
          {t("¿Ya tienes cuenta?")}{" "}<Link href="/entrar" className="text-glow">{t("Entrar")}</Link>
          {" · "}<Link href="/registro" className="text-glow">{t("TWO LOVE Private (21+)")}</Link>
        </p>
      </div>
    </div>
  );
}

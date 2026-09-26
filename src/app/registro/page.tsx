import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { register } from "../actions/auth";
import { Flash, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function RegisterPage({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const q = await searchParams;
  const ref = (sp(q.ref) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex justify-center"><LogoMark size={88} /></div>
      <h1 className="h1 text-center">{t("Solicitar acceso")}</h1>
      <p className="mt-2 text-center text-muted">{t("Crea tu cuenta y completa las 5 verificaciones para activar tu perfil.")}</p>
      <div className="card mt-8">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        {ref && <div className="mb-4 rounded-xl border border-brand/40 p-3 text-sm text-glow">Te ha invitado un miembro de TWO LOVE ({ref}). Recibirás un bono extra de bienvenida.</div>}
        <form action={register} className="space-y-4">
          <input type="hidden" name="ref" value={ref} />
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
            <label className="label" htmlFor="source">{t("¿Cómo nos conociste?")}</label>
            <select className="input" id="source" name="source" defaultValue="organico">
              <option value="organico">{t("Búsqueda / web")}</option>
              <option value="instagram">{t("Instagram")}</option>
              <option value="referido">{t("Invitación de un miembro")}</option>
              <option value="evento_privado">{t("Evento privado")}</option>
              <option value="alianza">{t("Marca aliada")}</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="terms" className="check mt-1" required />
            <span>{t("Soy mayor de 21 años y acepto los términos, la política de privacidad, el tratamiento de datos sensibles para verificación y el código de conducta.")}</span>
          </label>
          <button className="btn-brand w-full" type="submit">{t("Crear cuenta")}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {t("¿Ya eres miembro?")}{" "}<Link href="/entrar" className="text-glow">{t("Entrar")}</Link>
        </p>
      </div>
    </div>
  );
}

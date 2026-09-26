import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { login } from "../actions/auth";
import { Flash, sp, type SP } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const t = await getT();
  const q = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex justify-center"><LogoMark size={88} /></div>
      <h1 className="h1 text-center">{t("Bienvenido/a de nuevo")}</h1>
      <p className="mt-2 text-center text-muted">{t("Accede a tu cuenta TWO LOVE.")}</p>
      <div className="card mt-8">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <form action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">{t("Email")}</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("Contraseña")}</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn-brand w-full" type="submit">{t("Entrar")}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {t("¿Aún no eres miembro?")}{" "}<Link href="/registro" className="text-glow">{t("Solicita acceso")}</Link>
        </p>
      </div>
      <div className="card mt-6 text-sm text-muted">
        <div className="mb-2 font-medium text-ivory">{t("Cuentas de demostración")}</div>
        <p>{t("Miembro Platinum:")}{" "}<code className="text-glow">demo@twolove.app</code></p>
        <p>{t("Administración (CRM/ERP):")}{" "}<code className="text-glow">admin@twolove.app</code></p>
        <p>{t("Contraseña:")}{" "}<code className="text-glow">twolove2026</code></p>
      </div>
    </div>
  );
}

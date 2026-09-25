import Link from "next/link";
import { login } from "../actions/auth";
import { Flash, sp, type SP } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="h1 text-center">Bienvenido/a de nuevo</h1>
      <p className="mt-2 text-center text-muted">Accede a tu cuenta TWO LOVE.</p>
      <div className="card mt-8">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <form action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn-gold w-full" type="submit">Entrar</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          ¿Aún no eres miembro? <Link href="/registro" className="text-gold-2">Solicita acceso</Link>
        </p>
      </div>
      <div className="card mt-6 text-sm text-muted">
        <div className="mb-2 font-medium text-ivory">Cuentas de demostración</div>
        <p>Miembro Platinum: <code className="text-gold-2">demo@twolove.app</code></p>
        <p>Administración (CRM/ERP): <code className="text-gold-2">admin@twolove.app</code></p>
        <p>Contraseña: <code className="text-gold-2">twolove2026</code></p>
      </div>
    </div>
  );
}

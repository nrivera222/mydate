import Link from "next/link";
import { register } from "../actions/auth";
import { Flash, sp, type SP } from "@/components/ui";

export default async function RegisterPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="h1 text-center">Solicitar acceso</h1>
      <p className="mt-2 text-center text-muted">Crea tu cuenta y completa las 5 verificaciones para activar tu perfil.</p>
      <div className="card mt-8">
        <Flash ok={sp(q.ok)} error={sp(q.error)} />
        <form action={register} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Nombre completo</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="source">¿Cómo nos conociste?</label>
            <select className="input" id="source" name="source" defaultValue="organico">
              <option value="organico">Búsqueda / web</option>
              <option value="instagram">Instagram</option>
              <option value="referido">Invitación de un miembro</option>
              <option value="evento_privado">Evento privado</option>
              <option value="alianza">Marca aliada</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="terms" className="check mt-1" required />
            <span>Soy mayor de 21 años y acepto los términos, la política de privacidad, el tratamiento de datos sensibles para verificación y el código de conducta.</span>
          </label>
          <button className="btn-gold w-full" type="submit">Crear cuenta</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya eres miembro? <Link href="/entrar" className="text-gold-2">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { one, run } from "./db";

const COOKIE = "tl_session";
const DEV_SECRET = "two-love-dev-secret-change-me-in-production-please";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET es obligatorio en producción");
  }
  return new TextEncoder().encode(s ?? DEV_SECRET);
}

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  tier: string;
  status: string;
  /** full = ecosistema completo (21+) · park = solo TWO LOVE Park (18+) */
  scope: "full" | "park";
};

export async function createSession(userId: number) {
  const token = await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = one<SessionUser>("SELECT id, email, name, role, tier, status, scope FROM users WHERE id = ?", Number(payload.sub));
    if (!user || user.status !== "active") return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Exige sesión. Las cuentas "solo Park" (18–20 años o registro desde el Park) solo acceden a lo que
 * lo permite explícitamente con { park: true }: el resto del ecosistema es para mayores de 21.
 */
export async function requireUser(opts: { park?: boolean } = {}): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (user.scope === "park" && !opts.park) redirect("/park");
  run("UPDATE users SET last_active_at = datetime('now') WHERE id = ?", user.id);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/descubrir");
  return user;
}

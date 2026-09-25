import { redirect } from "next/navigation";

/** Redirige con un mensaje para mostrar en la página de destino. */
export function flash(to: string, message: string, kind: "ok" | "error" = "ok"): never {
  const [path, hash] = to.split("#");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`);
}

export function str(fd: FormData, key: string, max = 2000) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function int(fd: FormData, key: string) {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function list(fd: FormData, key: string, allowed?: readonly string[]) {
  const vals = fd.getAll(key).filter((v): v is string => typeof v === "string");
  return allowed ? vals.filter((v) => allowed.includes(v)) : vals;
}

import fs from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { MIME_BY_EXT, resolveUpload } from "@/lib/uploads";

// Sirve archivos subidos: fotos para miembros autenticados, documentos privados solo para administración.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const rel = (await params).path.join("/");
  const bucket = rel.split("/")[0];
  if (bucket === "private" && user.role !== "admin") return new Response("Prohibido", { status: 403 });
  if (bucket !== "photos" && bucket !== "private") return new Response("No encontrado", { status: 404 });
  const full = resolveUpload(rel);
  if (!full) return new Response("No encontrado", { status: 404 });
  try {
    const data = await fs.readFile(full);
    return new Response(data, {
      headers: {
        "Content-Type": MIME_BY_EXT[path.extname(full).slice(1)] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}

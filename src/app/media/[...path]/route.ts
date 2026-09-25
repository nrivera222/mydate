import { currentUser } from "@/lib/auth";
import { readUpload } from "@/lib/uploads";

// Sirve archivos subidos: fotos para miembros autenticados, documentos privados (cifrados) solo para administración.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const rel = (await params).path.join("/");
  const bucket = rel.split("/")[0];
  if (bucket === "private" && user.role !== "admin") return new Response("Prohibido", { status: 403 });
  if (bucket !== "photos" && bucket !== "private") return new Response("No encontrado", { status: 404 });
  try {
    const file = await readUpload(rel);
    if (!file) return new Response("No encontrado", { status: 404 });
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": bucket === "private" ? "no-store" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}

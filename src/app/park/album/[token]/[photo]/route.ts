import { one } from "@/lib/db";
import { albumByToken } from "@/lib/park";
import { readUpload } from "@/lib/uploads";

// Foto de un álbum del Park: acceso con el enlace del QR mientras el álbum está vigente.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; photo: string }> }) {
  const { token, photo } = await params;
  const b = albumByToken(token);
  const f = b ? one<{ file_path: string }>("SELECT file_path FROM park_photos WHERE id = ? AND booking_id = ?", Number(photo), b.id) : undefined;
  if (!f) return new Response("No encontrado", { status: 404 });
  try {
    const file = await readUpload(f.file_path);
    if (!file) return new Response("No encontrado", { status: 404 });
    return new Response(new Uint8Array(file.data), {
      headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}

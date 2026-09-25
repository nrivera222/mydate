import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": "pdf" };

export class UploadError extends Error {}

/**
 * Guarda un archivo subido. Las fotos de perfil van a "photos" (visibles para miembros);
 * documentos de identidad, médicos y psicológicos van a "private" (solo administración).
 */
export async function saveUpload(file: File | null, bucket: "photos" | "private"): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new UploadError("El archivo supera 5 MB.");
  const allowed = bucket === "photos" ? IMAGE_TYPES : DOC_TYPES;
  const ext = allowed[file.type];
  if (!ext) throw new UploadError(bucket === "photos" ? "La foto debe ser JPG, PNG o WEBP." : "El documento debe ser imagen o PDF.");
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(ROOT, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `${bucket}/${name}`;
}

export function resolveUpload(rel: string) {
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT + path.sep)) return null;
  return full;
}

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

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
  const data = Buffer.from(await file.arrayBuffer());
  // Los documentos sensibles (identidad, médicos, psicológicos) se cifran en reposo
  const name = bucket === "private" ? `${crypto.randomUUID()}.${ext}.enc` : `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(ROOT, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bucket === "private" ? encrypt(data) : data);
  return `${bucket}/${name}`;
}

const MAGIC = Buffer.from("TLE1");

let cachedKey: Buffer | null = null;
function key() {
  if (cachedKey) return cachedKey;
  cachedKey = deriveKey();
  return cachedKey;
}

function deriveKey() {
  const raw = process.env.UPLOAD_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("UPLOAD_ENCRYPTION_KEY debe ser 32 bytes en base64");
    return k;
  }
  // Derivada del secreto de sesión si no hay clave dedicada
  const secret = process.env.AUTH_SECRET ?? "two-love-dev-secret-change-me-in-production-please";
  return crypto.scryptSync(secret, "two-love-uploads", 32);
}

/** AES-256-GCM: MAGIC | iv(12) | tag(16) | ciphertext */
export function encrypt(data: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

export function decrypt(blob: Buffer) {
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error("Formato cifrado no reconocido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), blob.subarray(4, 16));
  decipher.setAuthTag(blob.subarray(16, 32));
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]);
}

/** Lee un archivo subido, descifrándolo si es necesario. Devuelve contenido y tipo MIME. */
export async function readUpload(rel: string) {
  const full = resolveUpload(rel);
  if (!full) return null;
  const raw = await fs.readFile(full);
  const encrypted = full.endsWith(".enc");
  const ext = path.extname(encrypted ? full.slice(0, -4) : full).slice(1);
  return { data: encrypted ? decrypt(raw) : raw, mime: MIME_BY_EXT[ext] ?? "application/octet-stream" };
}

export function resolveUpload(rel: string) {
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT + path.sep)) return null;
  return full;
}

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

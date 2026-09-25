"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { flash, str } from "@/lib/flash";
import { INSURANCE_PLANS, PSYCH_ITEMS, TRAITS } from "@/lib/catalog";
import { LedgerError, post, recordPayable, recordRevenue } from "@/lib/ledger";
import { saveUpload, UploadError } from "@/lib/uploads";

const BACK = "/verificacion";

async function upload(fd: FormData, key: string, required: boolean) {
  try {
    const rel = await saveUpload(fd.get(key) as File | null, "private");
    if (!rel && required) return { error: "Adjunta el documento solicitado." };
    return { rel };
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "No se pudo subir el archivo." };
  }
}

function insertVerification(userId: number, type: string, data: object, filePath: string | null | undefined, status = "pending") {
  transaction((conn) => {
    conn.prepare("INSERT INTO verifications (user_id, type, status, data, file_path, reviewed_at) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'approved' THEN datetime('now') END)")
      .run(userId, type, status, JSON.stringify(data), filePath ?? null, status);
  });
}

export async function submitIdentity(fd: FormData) {
  const user = await requireUser();
  const docType = str(fd, "doc_type", 40);
  const country = str(fd, "doc_country", 60);
  const last4 = str(fd, "doc_last4", 4).replace(/\D/g, "");
  if (!docType || !country || last4.length !== 4) flash(BACK, "Completa tipo de documento, país y los 4 últimos dígitos.", "error");
  const doc = await upload(fd, "document", true);
  if (doc.error) flash(BACK, doc.error, "error");
  const selfie = await upload(fd, "selfie", true);
  if (selfie.error) flash(BACK, selfie.error, "error");
  insertVerification(user.id, "identity", { docType, country, last4, selfie: selfie.rel }, doc.rel);
  revalidatePath(BACK);
  flash(BACK, "Identidad enviada. Nuestro equipo la revisará en menos de 24 h.");
}

export async function submitPsych(fd: FormData) {
  const user = await requireUser();
  const sums: Record<string, number[]> = Object.fromEntries(TRAITS.map((t) => [t, []]));
  for (const item of PSYCH_ITEMS) {
    const v = Number(fd.get(item.id));
    if (!(v >= 1 && v <= 5)) flash(BACK, "Responde todas las preguntas del test.", "error");
    const normalized = (v - 1) / 4;
    sums[item.trait].push(item.sign > 0 ? normalized : 1 - normalized);
  }
  const traits = Object.fromEntries(Object.entries(sums).map(([k, arr]) => [k, Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100]));
  const professional = str(fd, "professional", 120);
  const cert = await upload(fd, "certificate", false);
  if (cert.error) flash(BACK, cert.error, "error");
  if (!professional && !cert.rel) flash(BACK, "Indica el psicólogo evaluador o adjunta el informe.", "error");

  transaction((conn) => {
    conn.prepare("UPDATE profiles SET traits = ? WHERE user_id = ?").run(JSON.stringify(traits), user.id);
    conn.prepare("INSERT INTO verifications (user_id, type, status, data, file_path) VALUES (?, 'psychological', 'pending', ?, ?)")
      .run(user.id, JSON.stringify({ traits, professional }), cert.rel ?? null);
  });
  revalidatePath(BACK);
  flash(BACK, "Perfil psicológico enviado. Tus resultados ya mejoran tu compatibilidad.");
}

export async function submitMedical(fd: FormData) {
  const user = await requireUser();
  const clinic = str(fd, "clinic", 120);
  const examDate = str(fd, "exam_date", 10);
  const declared = fd.get("declaration") === "on";
  const consent = fd.get("consent") === "on";
  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) flash(BACK, "Indica clínica y fecha del examen.", "error");
  const ageDays = (Date.now() - new Date(examDate).getTime()) / 86_400_000;
  if (ageDays > 180 || ageDays < 0) flash(BACK, "El certificado médico debe tener menos de 6 meses.", "error");
  if (!declared || !consent) flash(BACK, "Debes firmar la declaración y el consentimiento de datos sensibles.", "error");
  const cert = await upload(fd, "certificate", true);
  if (cert.error) flash(BACK, cert.error, "error");
  insertVerification(user.id, "medical", { clinic, examDate }, cert.rel);
  revalidatePath(BACK);
  flash(BACK, "Certificado médico enviado. Solo se mostrará la insignia, nunca el contenido.");
}

export async function subscribeInsurance(fd: FormData) {
  const user = await requireUser();
  const plan = INSURANCE_PLANS.find((p) => p.id === str(fd, "plan"));
  const beneficiary = str(fd, "beneficiary", 120);
  if (!plan) flash(BACK, "Selecciona un plan de seguro.", "error");
  if (beneficiary.length < 3) flash(BACK, "Indica un beneficiario.", "error");
  if (fd.get("accept") !== "on") flash(BACK, "Debes aceptar las condiciones de la póliza.", "error");

  let err = "";
  try {
    transaction((conn) => {
      conn.prepare("UPDATE insurance_policies SET status = 'cancelada' WHERE user_id = ? AND status = 'active'").run(user.id);
      const r = conn.prepare("INSERT INTO insurance_policies (user_id, partner_id, plan, coverage, premium, beneficiary) VALUES (?, (SELECT id FROM partners WHERE category = 'seguros' LIMIT 1), ?, ?, ?, ?)")
        .run(user.id, plan.id, plan.coverage, plan.premium, beneficiary);
      const ref = `policy:${r.lastInsertRowid}`;
      post(conn, user.id, "seguro", -plan.premium, `Prima 1er mes · ${plan.label}`, ref);
      const commission = Math.round(plan.premium * 0.12);
      recordRevenue(conn, "seguro", commission, 0, user.id, ref);
      recordPayable(conn, "partner", { partnerId: (conn.prepare("SELECT id FROM partners WHERE category = 'seguros' LIMIT 1").get() as { id: number }).id }, plan.premium - commission, ref);
      conn.prepare("INSERT INTO verifications (user_id, type, status, data, reviewed_at) VALUES (?, 'insurance', 'approved', ?, datetime('now'))")
        .run(user.id, JSON.stringify({ plan: plan.id, policy: Number(r.lastInsertRowid) }));
    });
  } catch (e) {
    err = e instanceof LedgerError ? `${e.message} Recarga tu billetera para pagar la primera prima.` : "No se pudo contratar la póliza.";
  }
  if (err) flash(BACK, err, "error");
  revalidatePath(BACK);
  flash(BACK, `Póliza ${plan.label} activada.`);
}

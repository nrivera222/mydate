// Comprueba que todos los textos de la interfaz tienen traducción en inglés y árabe.
// Uso: node --experimental-strip-types scripts/i18n-check.mjs [--json]
// Fuentes de claves: llamadas t("…")/tr("…"), mensajes de flash() y notify() en las acciones,
// valores visibles del catálogo y contenido sembrado en la base de datos (regalos, Salas, eventos…).
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const files = walk(path.join(root, "src")).filter((f) => /\.(tsx?|mjs)$/.test(f) && !f.includes(`${path.sep}i18n${path.sep}`));

const keys = new Map(); // clave normalizada -> texto original
const add = (k, where) => {
  if (!k || !/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(k)) return;
  keys.set(norm(k), { key: k, where });
};
// Normaliza variables para comparar forma: {name} y ${expr} -> {*}
const norm = (s) => s.replace(/\$\{[^}]*\}|\{\w+\}/g, "{*}");

const strLit = String.raw`"((?:[^"\\]|\\.)*)"`;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(root, f);
  for (const m of src.matchAll(new RegExp(String.raw`\b(?:t|tr)\(\s*${strLit}`, "g"))) add(JSON.parse(`"${m[1]}"`), rel);
  // Ternario dentro de t( cond ? "a" : "b", …)
  for (const m of src.matchAll(new RegExp(String.raw`\bt\([^()"]*\?\s*${strLit}\s*:\s*${strLit}`, "g"))) {
    add(JSON.parse(`"${m[1]}"`), rel);
    add(JSON.parse(`"${m[2]}"`), rel);
  }
  // Errores de negocio mostrados al usuario (acciones y librerías)
  for (const m of src.matchAll(/(?:BusinessError|LedgerError|UploadError)\(\s*(?:[^"()]*\?\s*)?"((?:[^"\\]|\\.)*)"(?:\s*:\s*"((?:[^"\\]|\\.)*)")?/g)) {
    add(m[1], rel);
    if (m[2]) add(m[2], rel);
  }
  // Tablas de etiquetas en páginas: const ESTADOS = { clave: "Texto", … } / [["Texto", …]]
  if (rel.startsWith(`src${path.sep}app`) && (rel.endsWith("page.tsx") || rel.endsWith("layout.tsx"))) {
    for (const block of src.matchAll(/^const [A-Z_]+[^=\n]*=\s*([\[{][\s\S]*?^[\]}]);/gm)) {
      for (const m of block[1].matchAll(new RegExp(strLit, "g"))) {
        const v = JSON.parse(`"${m[1]}"`);
        if (/^[A-ZÁÉÍÓÚ¿¡]/.test(v) && !/^[a-z0-9:/\[\]\-\s.%]+$/.test(v)) add(v, rel);
      }
    }
  }
  if (rel.includes(`actions${path.sep}`) || rel.includes(`${path.sep}api${path.sep}`)) {
    // Segundo argumento de flash() y títulos/cuerpos de notify()
    for (const m of src.matchAll(/flash\([^,]+,\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")/g)) add(m[1].slice(1, -1), rel);
    for (const m of src.matchAll(/notify\(conn,[^,]+,\s*"[a-z]+",\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")(?:,\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"))?/g)) {
      add(m[1].slice(1, -1), rel);
      if (m[2]) add(m[2].slice(1, -1), rel);
    }
    // Mensajes de error de negocio
    for (const m of src.matchAll(/(?:BusinessError|LedgerError)\(\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1], rel);
    // Descripciones de movimientos de billetera: post(conn, x, "tipo", importe, "texto" | `texto`)
    for (const m of src.matchAll(/post\(conn,[^,]+,\s*"[a-z_]+",\s*[^,]+,\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")/g)) add(m[1].slice(1, -1), rel);
  }
}

// Catálogo
const catalog = await import(path.join(root, "src/lib/catalog.ts"));
const c = catalog;
for (const t of c.TIERS) { add(t.tagline, "catalog"); t.benefits.forEach((b) => add(b, "catalog")); }
for (const a of c.ARCHETYPES) { add(a.label, "catalog"); add(a.desc, "catalog"); }
c.INTERESTS.forEach((x) => add(x, "catalog"));
c.LANGUAGES.forEach((x) => add(x, "catalog"));
for (const l of [c.GENDERS, c.INTENTS, c.NET_WORTH, c.INSURANCE_PLANS]) l.forEach((x) => add(x.label, "catalog"));
for (const x of c.CITIES) { add(x.city, "catalog"); add(x.country, "catalog"); }
for (const u of c.RATE_UNITS) { add(u.label, "catalog"); add(u.label.toLowerCase(), "catalog"); add(u.plural, "catalog"); add(u.per, "catalog"); }
c.COMPANION_ACTIVITIES.forEach((x) => add(x, "catalog"));
c.COMPANION_RULES.forEach((x) => add(x, "catalog"));
for (const v of c.VERIFICATION_TYPES) { add(v.label, "catalog"); add(v.desc, "catalog"); }
c.PSYCH_ITEMS.forEach((x) => add(x.text, "catalog"));
Object.values(c.TRAIT_LABELS).forEach((x) => add(x, "catalog"));
c.RATING_TAGS.forEach((x) => add(x, "catalog"));
c.REPORT_REASONS.forEach((x) => add(x, "catalog"));
Object.values(c.STREAM_LABEL).forEach((x) => add(x, "catalog"));

// Valores internos que se muestran traducidos (estados, tipos, canales, etapas del CRM)
const ENUMS = ["requested", "accepted", "completed", "declined", "cancelled", "disputed", "companion", "lounge", "approved", "pending", "rejected",
  "nota", "llamada", "concierge", "incidencia", "pagado", "preparando", "entregado", "nuevo", "en_curso", "resuelto", "publicado", "cancelado",
  "organico", "instagram", "referido", "evento_privado", "alianza", "google", "interno",
  "Suspendido", "Lead · verificando", "En riesgo", "VIP", "Suscriptor", "Verificado · free"];
ENUMS.forEach((x) => add(x, "enum"));

// Contenido sembrado
const dbFile = process.env.DATABASE_PATH ?? path.join(root, "data", "twolove.db");
if (fs.existsSync(dbFile)) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const q = (sql) => db.prepare(sql).all();
  for (const r of q("SELECT name, description FROM gifts")) { add(r.name, "db:gifts"); add(r.description, "db:gifts"); }
  for (const r of q("SELECT description, amenities FROM lounges")) { add(r.description, "db:lounges"); r.amenities.split(",").forEach((a) => add(a.trim(), "db:lounges")); }
  for (const r of q("SELECT benefit FROM partners")) add(r.benefit, "db:partners");
  for (const r of q("SELECT title, description, venue FROM events")) { add(r.title, "db:events"); add(r.description, "db:events"); add(r.venue, "db:events"); }
} else {
  console.warn("Aviso: no hay base de datos; no se comprueba el contenido sembrado.");
}

const locales = { en: (await import(path.join(root, "src/lib/i18n/en.ts"))).default, ar: (await import(path.join(root, "src/lib/i18n/ar.ts"))).default };
const report = {};
for (const [loc, dict] of Object.entries(locales)) {
  const have = new Set(Object.keys(dict).map(norm));
  report[loc] = [...keys.values()].filter((k) => !have.has(norm(k.key))).map((k) => k.key);
  // Claves con variables: deben conservar los mismos nombres en la traducción
  for (const [k, v] of Object.entries(dict)) {
    const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    if (vars(k) !== vars(v)) report[`${loc}_vars`] = [...(report[`${loc}_vars`] ?? []), k];
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 1));
} else {
  console.log(`Claves: ${keys.size}`);
  let fail = false;
  for (const [k, list] of Object.entries(report)) {
    if (list.length) fail = true;
    console.log(`${k}: ${list.length} ${list.length ? "pendientes" : "✓"}`);
    list.slice(0, 20).forEach((x) => console.log("   ·", x));
  }
  process.exit(fail ? 1 : 0);
}

// Borra la base de datos local; se regenera con datos de demostración en el próximo arranque.
import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "twolove.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
console.log("Base de datos eliminada:", file);

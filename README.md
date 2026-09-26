# TWO LOVE

Ecosistema web global de citas premium para personas de alto perfil (empresarios/as, herederos/as, ejecutivos/as, figuras públicas), con foco inicial en **Dubái y el Golfo**.

Incluye dos categorías de encuentro, verificación en 5 pasos, billetera digital con custodia (escrow), membresías del nivel básico al lujo, **Salas TWO LOVE** (recintos de la marca para citas), regalos con marcas aliadas, valoraciones, concierge y un back-office con **CRM** y **ERP**.

> Estudio de mercado, modelo de negocio y consideraciones legales: [`docs/MODELO_NEGOCIO.md`](docs/MODELO_NEGOCIO.md) · Arquitectura: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)

## Puesta en marcha

Requisitos: **Node.js 22.13+** (usa el módulo nativo `node:sqlite`, sin dependencias de base de datos externas).

```bash
npm install
npm run dev            # http://localhost:3000
```

La primera petición crea `data/twolove.db` y la llena con datos de demostración (28 miembros, aliados, Salas, regalos, reservas e historial de ingresos de 6 meses).

| Cuenta | Email | Contraseña |
|---|---|---|
| Miembro Platinum (verificado, con matches y saldo) | `demo@twolove.app` | `twolove2026` |
| Administración (CRM / ERP / verificaciones) | `admin@twolove.app` | `twolove2026` |
| Miembro pendiente de verificar | `nuevo@demo.twolove.app` | `twolove2026` |

Producción:

```bash
cp .env.example .env    # define AUTH_SECRET (obligatorio en producción)
npm run build && npm start
npm run db:reset        # borra la base; se regenera con datos demo
```

## Marca

El símbolo de TWO LOVE es una **“pulse sphere”**: una esfera de latitudes doradas atravesada por un latido que deforma las líneas del ecuador. Se genera de forma procedural en SVG (`src/lib/logo.ts`), así que es nítido a cualquier tamaño; en la web se anima con un destello que recorre el pulso y un halo que late (se desactiva con *reducir movimiento*).

- Componente: `<LogoMark />` y `<Logo />` en `src/components/Logo.tsx`.
- Archivos: `public/brand/two-love-mark.svg` (fondo oscuro) y `two-love-mark-transparent.svg`; favicon en `src/app/icon.svg`.
- Regenerar tras cambiar la geometría: `node --experimental-strip-types scripts/generate-icons.mjs`.

### Visual "Pulse Sphere" (energía de partículas)

Ilustración generativa en tiempo real (`src/components/PulseSphere.tsx`, canvas 2D sin dependencias): miles de partículas luminosas en una esfera que late, núcleo de plasma, filamentos de luz en órbita, niebla volumétrica, profundidad de campo, polvo *bokeh* y viñeta cinematográfica, en paleta púrpura neón y azul eléctrico. Reacciona al ratón (paralaje), se pausa fuera de pantalla, reduce partículas en móvil y queda estática con *reducir movimiento*.

- Se usa como fondo de la portada y a pantalla completa, sin texto, en `/visual` (`?n=partículas&still=1&t=instante`).
- Imágenes exportadas en `public/brand/`: `pulse-sphere-8k.jpg` (7680×4320), `pulse-sphere-4k.jpg`, `pulse-sphere-square.jpg` (2160×2160) y `pulse-sphere-vertical.jpg` (2160×3840, historias/reels).

## Idiomas

La interfaz está disponible en **español, inglés y árabe** (con dirección RTL y tipografía árabe). El idioma se elige con el selector ES · EN · ع de la cabecera, se guarda en una cookie y, en la primera visita, se detecta del navegador (`Accept-Language`).

- Las traducciones viven en `src/lib/i18n/en.ts` y `src/lib/i18n/ar.ts`; la clave es el texto original en español (`t("Guardar perfil")`).
- Los avisos de las acciones y las notificaciones guardadas se traducen al mostrarse, reconociendo partes variables (`"Recarga de {a} completada."`) y reformateando importes al idioma activo.
- `npm run i18n:check` verifica que todo texto de la interfaz, del catálogo y del contenido sembrado tiene traducción en ambos idiomas (1.061 claves).
- El contenido que escribe cada miembro (biografía, ocupación, mensajes) no se traduce.

## Qué incluye

### Para miembros
| Módulo | Ruta | Descripción |
|---|---|---|
| Registro y cuenta | `/registro`, `/entrar` | Alta con canal de adquisición (para el CRM), sesión firmada (JWT en cookie httpOnly), +21 años. |
| Perfil | `/perfil/editar` | Género, géneros buscados, rango de edad, ciudad, **prototipo internacional**, patrimonio, intención (matrimonio / noviazgo / conocer), intereses, idiomas, modo incógnito. |
| Verificación | `/verificacion` | 1) Identidad (documento + selfie) · 2) Foto clara · 3) Perfil psicológico (test Big Five + aval profesional) · 4) Perfil médico (certificado < 6 meses) · 5) **Seguro de vida** obligatorio (3 planes, prima cobrada de la billetera). Sin las 5 no se puede dar like, regalar ni reservar. |
| **Citas reales** | `/descubrir`, `/perfil/[id]` | Descubrimiento filtrado por compatibilidad de género mutua, edad, prototipo, ciudad, intención y patrimonio (Gold+). Puntuación de compatibilidad 0–100 (intereses, personalidad, prototipo, idiomas, ubicación, intención). Like / Super Like / Pasar con límites por membresía, “Les gustas”, matches. |
| **Acompañamiento social** (“citas falsas”) | `/acompanantes` | Alquiler de acompañante verificado **por hora, día, semana, mes o año** para galas, bodas, eventos corporativos o viajes. Pago en custodia → el acompañante acepta → check-in de seguridad → el cliente confirma y se libera el pago (menos 15% de comisión). Cancelaciones, disputas y reembolsos. Estrictamente social y platónico. |
| Salas TWO LOVE | `/salas` | Recintos de la marca (rooftop, yate, majlis en el desierto, suite, spa, palacio…) en Dubái, Abu Dabi, Doha, Riad, Mónaco y Londres. Acceso según membresía, control de solapes de horario, invitación a un match. |
| Regalos | `/regalos` | Virtuales (el receptor recibe el 40% como saldo) y físicos de marcas aliadas (flores, joyería, experiencias, lujo) con stock y logística. Descuento según membresía. |
| Mensajes | `/mensajes` | Chat entre matches o con reserva activa, con aviso anti-fraude si se comparten teléfonos o datos bancarios. |
| Billetera | `/billetera` | Saldo, fondos en custodia, recargas, retiros por IBAN (revisión AML), movimientos, vista en AED/USD/EUR/GBP/SAR. |
| Membresías | `/membresias` | Essential (gratis) · Gold · Platinum · Diamond · **Royal Black** (por invitación). Mensual o anual. |
| Aliados | `/aliados` | Beneficios de marcas (joyería, yates, aviación privada, hoteles, moda, clínicas…) desbloqueados por nivel. |
| Concierge | `/concierge` | 24/7 para Diamond y Royal Black (matchmaker humano en Royal). |
| Eventos privados | `/eventos` | Yates, cenas a ciegas por compatibilidad, galas. Entradas pagadas desde la billetera con descuento por nivel, aforo, código de entrada y “Quién va” (solo visible con entrada). |
| Notificaciones | `/notificaciones` | Matches, Super Likes, mensajes, reservas, pagos liberados, regalos, verificaciones, eventos y referidos. Contador en la cabecera. |
| Invita y gana | `/billetera#invitar` | Código personal: el invitado recibe 50 AED extra y quien invita 150 AED cuando el invitado contrata su primera membresía. |
| Valoraciones y seguridad | `/reservas`, `/perfil/[id]` | Estrellas + etiquetas tras cada encuentro; denunciar y bloquear. |

### Back-office (`/admin`, solo rol admin)
- **Resumen**: miembros, % verificados, MRR, ingresos y GMV a 30 días, ingresos por mes y por línea, distribución por membresía, ciudad y prototipo.
- **Verificaciones**: cola de revisión con acceso a documentos privados, aprobar/rechazar con motivo.
- **CRM**: embudo (Lead → Verificado → Suscriptor → VIP / En riesgo), LTV neto por miembro, canales de adquisición, filtros, ficha 360° (timeline de notas/llamadas, verificaciones, billetera, reservas, crédito de cortesía, suspensión) y cola de concierge.
- **ERP**: cuenta de resultados por línea de ingreso con IVA (5%, EAU), cuentas por pagar (aliados y acompañantes), custodia y pasivo de billeteras, pedidos de regalos físicos con estados de logística, inventario con reposición, alianzas (comisión, facturación de patrocinios, alta de aliados), rendimiento de Salas y MRR por plan.
- **Eventos**: programación, aforo, ventas e ingresos por evento; cancelación con reembolso automático y aviso a los asistentes.
- **Seguridad**: disputas con fondos congelados (reembolsar o pagar), encuentros próximos con check-in y denuncias.

## Estructura

```
src/
  app/                 páginas (App Router) y server actions
    actions/           auth, profile, verification, social, commerce, admin
    admin/             resumen, verificaciones, crm, erp, seguridad
    media/[...path]    servidor de archivos subidos con control de acceso
  lib/
    catalog.ts         reglas de negocio: membresías, prototipos, tarifas, IVA, comisiones
    db.ts              esquema SQLite y helpers
    ledger.ts          contabilidad de billetera, custodia, ingresos, cuentas por pagar
    matching.ts        algoritmo de compatibilidad
    discovery.ts       filtrado y orden del descubrimiento
    seed.ts            datos de demostración
  components/ui.tsx    componentes de interfaz
docs/                  modelo de negocio y arquitectura
```

## Estado y siguientes pasos

Esto es un MVP funcional de extremo a extremo. Antes de lanzar en producción:

- Configurar Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, webhook en `/api/pagos/stripe` con los eventos `checkout.session.completed` y `checkout.session.expired`). Sin claves, las recargas se aprueban al instante en modo demo.
- Proveedor KYC automático (p. ej. UAE Pass, Onfido, Sumsub) y detección de vivacidad para la selfie.
- Los documentos sensibles ya se cifran en reposo con AES-256-GCM (`UPLOAD_ENCRYPTION_KEY`); en producción moverlos a S3/Blob con la clave en un KMS.
- Migrar de SQLite a PostgreSQL para escalar (el esquema es SQL estándar).
- Más idiomas (ruso, francés, chino) añadiendo un diccionario en `src/lib/i18n/`, y app móvil.
- Revisión legal local (ver `docs/MODELO_NEGOCIO.md`, sección de cumplimiento).

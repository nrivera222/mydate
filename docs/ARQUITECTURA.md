# Arquitectura

## Stack
- **Next.js 16 (App Router) + React 19 + TypeScript**: páginas renderizadas en servidor y *server actions* para todas las mutaciones (formularios HTML que funcionan sin JavaScript en el cliente).
- **Tailwind CSS 4**: tema negro/dorado/marfil definido en `src/app/globals.css`.
- **SQLite nativo de Node (`node:sqlite`)**: cero dependencias de base de datos; esquema en `src/lib/db.ts`. SQL estándar para migrar a PostgreSQL.
- **Autenticación**: contraseñas con bcrypt, sesión en JWT HS256 (`jose`) en cookie httpOnly/SameSite=Lax, `AUTH_SECRET` obligatorio en producción.

## Modelo de datos

```
users ─┬─ profiles (1:1)            perfil, preferencias, prototipo, rasgos psicológicos
       ├─ verifications (1:N)       identity | photo | psychological | medical | insurance
       ├─ insurance_policies (1:N)
       ├─ companion_offers (1:1)    tarifas por hora/día/semana/mes/año
       ├─ likes / messages / blocks / reports
       ├─ wallets (1:1) ─ wallet_tx (1:N)       saldo + custodia, libro de movimientos
       ├─ subscriptions (1:N)
       ├─ bookings (N)              companion | lounge, importes desglosados y estado
       ├─ ratings (N)
       ├─ gift_orders (N) ─ gifts ─ partners
       ├─ crm_notes / concierge_requests
lounges ─ partners
revenue    libro de ingresos por línea (ERP)
payables   cuentas por pagar a aliados y miembros (ERP)
```

## Flujo de dinero (`src/lib/ledger.ts`)
Todas las operaciones van en una transacción SQLite (`BEGIN IMMEDIATE`), así que un fallo (p. ej. saldo insuficiente) revierte todo.

**Reserva de acompañamiento**
1. Cliente solicita → `hold()` mueve `total` de saldo disponible a custodia.
2. Acompañante rechaza / cliente cancela → se libera la custodia y se reembolsa (si ya estaba aceptada, se retiene la tarifa de servicio).
3. Cliente confirma el encuentro → se libera la custodia, el acompañante recibe `subtotal − 15%`, y se registran en `revenue` la tarifa de servicio (+IVA) y la comisión.
4. Disputa → fondos congelados hasta que administración resuelve a favor de una de las partes.

**Regalo**: se cobra `precio − descuento de nivel + IVA`; si es virtual el receptor recibe el 40%; si es físico se decrementa stock y se crea una cuenta por pagar al aliado por el coste.

**Suscripción**: precio con IVA incluido → `revenue` separa neto e IVA; se abona el crédito mensual del plan.

## Seguridad
- Las mutaciones validan en servidor: sesión, propiedad del recurso, estado, verificación completa, límites por membresía y bloqueos.
- Archivos: tipo y tamaño validados; fotos en `data/uploads/photos` (solo miembros autenticados), documentos en `data/uploads/private` (solo admin), protección contra path traversal en `/media`.
- Datos médicos/psicológicos: la ficha pública solo muestra insignias.
- Mensajes: aviso ante teléfonos, IBAN o palabras de pago externo.
- Perfiles incógnito solo visibles para quien ya recibió su like; bloqueos bidireccionales.

# PROD-READINESS — OpenFinances

> Auditoría de preparación para producción basada en evidencia real de los archivos del repo.
> Fecha de auditoría: 2026-09-10.

## 1. Estado actual

- **Qué es:** PWA de finanzas personales para parejas que presupuestan en quincenas diferentes (dual bi-weekly + mensual), con aislamiento por usuario. Fuente: `README.md`.
- **Stack real (verificado):**
  - **Framework:** Next.js 16 (App Router, Server Actions, RSC). Evidencia: `package.json` (`next: 16.3.4`), `next.config.ts`, `app/actions.ts` (`"use server"`), `app/page.tsx`, `app/layout.tsx`.
  - **Lenguaje:** TypeScript (strict). `tsconfig.json`.
  - **Estilos:** Tailwind CSS 4.
  - **DB:** PostgreSQL en Supabase vía **Drizzle ORM** (`drizzle/`, `drizzle.config.ts`, `db/`). Evidencia: `drizzle/0000_initial_schema.sql`, `0001_add_password_hash.sql`.
  - **Auth:** Auth.js v5 (`next-auth@5.0.0-beta.32`) — Google OAuth + credentials (scrypt), sesión JWT. Evidencia: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`.
  - **Hosting:** Vercel. `package.json` scripts `dev/build/start`.
  - **PWA:** `app/manifest.ts`, iconos en `public/`, UI dark glassmorphism. ✅
  - **Tests:** **43 tests** en 4 archivos (`test/`) con `node:test` vía `tsx`. ✅ Evidencia: `test/` (cycle, fixed-scope, live-refresh, password), `README.md`.
- **Persistencia real:** Sí — Drizzle + Supabase Postgres, migraciones SQL presentes. Aislamiento por usuario en capa de app (`getCurrentUser()` en `auth.ts`; el cliente nunca envía `user_id`). ✅
- **Validación de entradas:** Sí — `app/actions.ts` tiene `validateDescription`, `validateAmount`, `validateCategory` (límites de longitud, decimales, >0). ✅
- **Conclusión:** Es el repositorio **más cercano a producción** de los tres. Faltan pulidos de config/deploy y un gap de gestor de paquetes.

## 2. Tabla priorizada de pendientes

| Pri | Ítem | Evidencia / por qué |
|-----|------|---------------------|
| **P0** | Migrar gestor a pnpm | `README.md` y scripts usan `npm install`; `package.json` **no** tiene `packageManager`; solo existe `package-lock.json` (sin `pnpm-lock.yaml`). Regla del workspace: usar pnpm. |
| **P1** | Corregir comentario engañoso en `.env.example` | Dice "Empty = deny all sign-ins" pero `auth.ts` `isEmailAuthorized` devuelve `true` si `ALLOWED_EMAILS` está vacío → **registro abierto**. El código y el `README.md` dicen "open registration"; el comentario del `.env.example` es contradictorio y peligroso. |
| **P1** | Confirmar deploy en Vercel + env vars | `README.md` describe deploy pero no verificado si ya está en Vercel. Setear `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `ALLOWED_EMAILS`. |
| **P1** | Estrategia de aislamiento (sin RLS) | Usa Drizzle directo a Postgres (no RLS de Supabase). El aislamiento depende de filtrar por `user_id` en cada query vía `getCurrentUser`. Auditar que ningún Server Action omita el filtro. |
| **P2** | `next.config.ts` vacío | Sin security headers (CSP, HSTS), sin config de imágenes. Añadir headers en prod. |
| **P2** | Sin `middleware.ts` | Auth vía callback `signIn` + Server Actions. Aceptable, pero un middleware edge daría protección uniforme de rutas. |
| **P2** | Verificar `next build` en CI | Tests corren (`tsx --test`); build de producción no verificado en esta auditoría (sin instalar deps). |
| **P2** | SEO/mobile | PWA instalable ✅; metadata/OG tags no verificados. |

## 3. Variables de entorno requeridas

> Fuente: `.env.example` (presente ✅) y `README.md`. Cargadas por Next.js (`.env.local`). `drizzle.config.ts` carga `.env.local` para CLI.

| Variable | Uso | Dónde hoy |
|----------|-----|-----------|
| `DATABASE_URL` | Connection string Postgres de Supabase (URI) | `.env.example` + `drizzle.config.ts` (`dbCredentials.url`). |
| `AUTH_SECRET` | Secreto de sesión Auth.js (`openssl rand -base64 32`) | `.env.example`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth Google | `.env.example`; `auth.ts` `isGoogleConfigured` las lee. |
| `ALLOWED_EMAILS` | Lista de correos permitidos (vacío = **abierto**, ver riesgo) | `.env.example` (comentario engañoso), `auth.ts` `getAllowedEmails`. |

> `.gitignore` ignora `.env*` y mantiene `!.env.example` ✅. Sin `.env.local` commiteado ✅.

## 4. Plan de deployment paso a paso

```bash
# 1) Migrar a pnpm (P0)
rm package-lock.json
pnpm install                 # genera pnpm-lock.yaml

# 2) Variables
cp .env.example .env.local   # editar con valores reales

# 3) Esquema BD (Supabase Postgres)
npx drizzle-kit migrate      # o pegar drizzle/0000_*.sql y 0001_*.sql en el SQL editor

# 4) Local
pnpm dev                     # http://localhost:3000
pnpm build && pnpm start     # smoke test producción

# 5) Tests
pnpm exec tsx --test test/   # 43 tests

# 6) Deploy Vercel
#   Conectar repo. Setear en Vercel: DATABASE_URL, AUTH_SECRET,
#   AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS.
#   Google Console: redirect URI = https://<domain>/api/auth/callback/google
```
> PWA: icons ya en `public/`, manifest en `app/manifest.ts` — no requiere pasos extra.

## 5. Riesgos de seguridad

1. **P1 — Comentario engañoso en `.env.example`:** indica "Empty = deny all sign-ins", pero `auth.ts:37-43` (`isEmailAuthorized`) retorna `true` cuando `ALLOWED_EMAILS` está vacío → **cualquier cuenta Google autenticada entra**. Si el operador deja el campo vacío confiando en el comentario, el acceso queda abierto. Corregir el comentario o cambiar el comportamiento por defecto a cerrado.
2. **P1 — Aislamiento sin RLS:** al usar Drizzle contra Postgres directo (no RLS de Supabase), una sola query que olvide filtrar por `user_id` expone datos de otros usuarios. El patrón `getCurrentUser()` está bien, pero conviene revisión de todas las queries en `app/actions.ts` y `lib/`.
3. **P2 — `next.config.ts` sin headers:** recomendar añadir `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` en producción.
4. **P2 — `ALLOWED_EMAILS` como única puerta:** si se usa allowlist, asegurar que no quede vacío en prod (ver riesgo #1).
5. **Buenas prácticas presentes:** contraseñas con scrypt (`lib/password`), sesión JWT, `.env*` ignorado, tests de lógica crítica (ciclos/password), PWA. ✅

---
*Evidencia: `README.md`, `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `.env.example`, `auth.ts`, `app/actions.ts`, `app/manifest.ts`, `test/` (4 archivos), `.gitignore`. Ítems no presentes en archivos marcados "no verificado".*

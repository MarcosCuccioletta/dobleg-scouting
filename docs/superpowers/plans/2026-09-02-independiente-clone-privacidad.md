# Clon de Independiente + Privacidad (BASE_AGENCY_PLAYERS, Seguimiento GG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la carpeta `independiente-platform` como copia de Scout Platform (sin el historial de git de Doble G) y, dentro de esa copia, vaciar los datos confidenciales de Doble G hardcodeados en el código y ocultar el subsistema "Seguimiento GG" (agency-specific, no aplica a un club).

**Architecture:** `git archive HEAD` exporta el estado actual trackeado (sin arrastrar el historial de commits de Doble G, evitando que datos viejos de `agencyPlayers.ts` queden recuperables por `git log`), se vuelca a la carpeta nueva, se inicializa un repo git fresco ahí. Dentro de la copia: `BASE_AGENCY_PLAYERS` pasa a array vacío (esa plataforma no tiene el concepto de "cartera de representados"), se eliminan los 3 tests que dependían de esos fixtures, y se ocultan del menú + las rutas de `/seguimiento-gg`, `/seguimiento-datos` y `/evaluaciones` (subsistema "Seguimiento GG" — pipeline interno de scouts de Doble G, tablas `scout_players`/`scout_players_status`).

**Tech Stack:** Git (`git archive`), Node/npm, React Router (rutas en `App.tsx`), mismo stack que Scout Platform.

**Spec:** `docs/superpowers/specs/2026-09-02-independiente-platform-design.md` (sección 1 "Repos y deploy", sección 5 "Qué vaciar al clonar")

## Global Constraints

- Todo lo de este plan pasa DENTRO de la carpeta `independiente-platform` una vez creada (Task 1) — ninguna task modifica `primer-appcloud` (este repo, Scout Platform).
- La copia usa el mismo Supabase (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de `.env.local`, mismo proyecto `qgwmxjjumauortbwvivu`) — no se crea infraestructura nueva en este plan (Netlify queda para más adelante, decisión ya tomada con el usuario).
- La copia arranca sin historial de git de Doble G (un solo commit inicial) — es intencional, no un descuido: evita que datos confidenciales viejos de `agencyPlayers.ts` queden recuperables vía `git log -p`.

---

### Task 1: Clonar el working tree a `independiente-platform`

**Files:**
- Create (fuera de este repo): todo el árbol de trabajo actual, copiado a `C:\Users\marcos\Desktop\Proyectos Claude\independiente-platform`

**Interfaces:**
- Produces: carpeta `independiente-platform` con un repo git propio (un commit), `node_modules` instalado, `.env.local` copiado — consumida por las Tasks 2 y 3 de este plan (que editan archivos dentro de esa carpeta).

- [ ] **Step 1: Exportar el estado trackeado actual (sin historial) a la carpeta nueva**

Desde `primer-appcloud`:

```bash
mkdir -p "/c/Users/marcos/Desktop/Proyectos Claude/independiente-platform"
git archive HEAD | (cd "/c/Users/marcos/Desktop/Proyectos Claude/independiente-platform" && tar -x)
```

Expected: la carpeta nueva tiene el mismo árbol de archivos que `primer-appcloud` (sin `.git`, sin `node_modules`), tal como está en el último commit.

- [ ] **Step 2: Copiar `.env.local` (gitignored, no viaja con `git archive`)**

```bash
cp "/c/Users/marcos/Desktop/Proyectos Claude/primer-appcloud/.env.local" "/c/Users/marcos/Desktop/Proyectos Claude/independiente-platform/.env.local"
```

Expected: el archivo existe en la carpeta nueva con las mismas credenciales de Supabase (mismo proyecto, intencional).

- [ ] **Step 3: Inicializar el repo git nuevo (sin historial de Doble G) y hacer el primer commit**

```bash
cd "/c/Users/marcos/Desktop/Proyectos Claude/independiente-platform"
git init
git add -A
git commit -m "Copia inicial de Scout Platform como base de la plataforma de Independiente"
```

Expected: `git log` muestra un único commit.

- [ ] **Step 4: Instalar dependencias y verificar que arranca**

```bash
npm install
npm test
```

Expected: `npm install` termina sin errores; `npm test` da el mismo resultado que en `primer-appcloud` en este momento (806 tests, todos en verde) — es una copia exacta, así que no debería haber ninguna diferencia todavía.

No hay commit de "Task" acá más allá del Step 3 (ya hecho) — las Tasks 2 y 3 van a generar sus propios commits dentro de este mismo repo nuevo.

---

### Task 2: Vaciar `BASE_AGENCY_PLAYERS` (privacidad)

**Files (dentro de `independiente-platform`):**
- Modify: `src/constants/agencyPlayers.ts`
- Delete: `src/features/gps/parser/parsePdf.test.ts`
- Delete: `src/features/gps/parser/parseXlsx.test.ts`
- Delete: `src/features/gps/parser/matchPlayers.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores de este plan (usa el código ya clonado en Task 1).
- Produces: `BASE_AGENCY_PLAYERS` vacío — consumido implícitamente por toda la app de la copia (ningún consumidor cambia de forma, solo de contenido).

- [ ] **Step 1: Vaciar el array**

En `independiente-platform/src/constants/agencyPlayers.ts`, reemplazar el contenido de `BASE_AGENCY_PLAYERS` (todas las filas de jugadores representados por Doble G) por un array vacío, dejando el tipo intacto:

```ts
export const BASE_AGENCY_PLAYERS: AgencyPlayer[] = []
```

- [ ] **Step 2: Eliminar los tests que dependían de esos jugadores como fixtures**

Estos 3 tests validan que el parser de GPS reconoce nombres específicos de jugadores de Doble G (Postigo, Steimbach, etc.) dentro de reportes de ejemplo — con el roster vacío dejan de tener sentido en esta copia (la función que testean, `parseGpsPdf`/`matchPlayers`, no cambia; solo pierde su fixture de datos):

```bash
rm src/features/gps/parser/parsePdf.test.ts
rm src/features/gps/parser/parseXlsx.test.ts
rm src/features/gps/parser/matchPlayers.test.ts
```

- [ ] **Step 3: Correr la suite para confirmar que queda en verde**

Run: `npm test`
Expected: PASS, con 3 archivos de test menos que en Task 1 (los que se borraron) y sin ningún test roto por el array vacío.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(privacidad): vacia BASE_AGENCY_PLAYERS (cartera de Doble G no aplica a Independiente)"
```

---

### Task 3: Ocultar el subsistema "Seguimiento GG" (agency-specific)

**Files (dentro de `independiente-platform`):**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/bottomNavItems.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: nada consumido por tasks posteriores — es la última pieza de este plan.

- [ ] **Step 1: Quitar las 3 rutas de `App.tsx`**

En `independiente-platform/src/App.tsx`, quitar estas 3 líneas de rutas (y sus imports `lazy` correspondientes si no se usan en ningún otro lado — `MonitoringPage`, `EvaluationsAdminPage`, `ScoutTrackingGGPage`):

```tsx
<Route path="/seguimiento-datos" element={<MonitoringPage />} />
```
```tsx
<Route path="/evaluaciones" element={<EvaluationsAdminPage />} />
```
```tsx
<Route path="/seguimiento-gg" element={<ScoutTrackingGGPage />} />
```

Y las 3 líneas de `lazy(() => import(...))` correspondientes a esas tres páginas, ya que quedan sin uso.

- [ ] **Step 2: Quitar las 2 entradas del menú principal en `Navbar.tsx`**

```tsx
{ to: '/seguimiento-gg', labelKey: 'nav.seguimientoGG', icon: 'shield' },
```
```tsx
{ to: '/seguimiento-datos', labelKey: 'nav.seguimientoDatos', icon: 'eye' },
```

- [ ] **Step 3: Quitar el link "Gestionar evaluaciones" del menú de usuario en `Navbar.tsx`**

El bloque `<NavLink to="/evaluaciones" ...>{t('nav.gestionarEvaluaciones')}</NavLink>` (junto a los links de "Perfil" y "Cerrar sesión" en el dropdown del usuario) — eliminarlo completo.

- [ ] **Step 4: Quitar la entrada de `bottomNavItems.ts`**

```ts
{ key: 'seguimiento', label: 'Seguimiento', to: '/seguimiento-gg' },
```

- [ ] **Step 5: Verificar que compila y corren los tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipos (ningún import roto), tests en verde. `bottomNavItems.test.ts` puede necesitar ajuste si asume la cantidad exacta de items — revisar su output si falla.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(privacidad): oculta el subsistema Seguimiento GG (agency-specific, no aplica a un club)"
```

---

### Task 4: Verificación final

**Files:** ninguno.

**Interfaces:** ninguna — task de verificación pura.

- [ ] **Step 1: Levantar la copia y navegar**

```bash
cd "/c/Users/marcos/Desktop/Proyectos Claude/independiente-platform"
npm run dev
```

Confirmar en el navegador: la app carga, el login funciona (mismo Supabase Auth), no aparecen "Seguimiento GG" ni "Seguimiento" ni "Gestionar evaluaciones" en ningún menú, y las 3 rutas quitadas devuelven la página 404 en vez de la pantalla vieja.

- [ ] **Step 2: Confirmar que Scout Platform (el repo original) sigue intacto**

```bash
cd "/c/Users/marcos/Desktop/Proyectos Claude/primer-appcloud"
git status
```

Expected: sin cambios respecto de antes de este plan (este plan nunca tocó archivos acá, solo leyó para el `git archive` inicial).

No hay commit en este task (no genera archivos).

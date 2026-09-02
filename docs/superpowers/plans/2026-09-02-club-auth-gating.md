# Gateo de Acceso por Club (perfil requerido tras login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario logueado sin fila en `user_profiles` (sin club asignado) vea una pantalla de "acceso no autorizado" en vez de la app — hoy, con RLS ya limitado por club (ver `2026-09-02-independiente-supabase-foundation.md`), un usuario sin perfil simplemente vería todo vacío, lo cual es confuso. Este es el "Plan 2" de la iniciativa de plataforma Independiente: se implementa en este repo (Scout Platform) para que el clon de Independiente lo herede ya funcionando.

**Architecture:** Nuevo servicio `getMyClubId(userId)` que consulta `user_profiles`. `AuthContext` lo llama después de resolver la sesión y expone `clubId: string | null | undefined` (`undefined` = todavía resolviendo, `null` = sin perfil, string = club real). `Layout.tsx` (que ya bloquea toda la app detrás de login) suma un chequeo: si hay usuario pero `clubId` es `null`, muestra una pantalla de "no autorizado" con botón de cerrar sesión, reusando el estilo visual de `NotFoundPage.tsx`.

**Tech Stack:** React 18 + TypeScript, Supabase JS client, Vitest (mock de `@/lib/supabase` con el patrón ya usado en `agencyCoachesService.test.ts`), sistema de traducciones propio (`src/constants/translations.ts`, 9 idiomas: es/en/tr/it/fr/de/ar/zh/ja).

**Spec:** `docs/superpowers/specs/2026-09-02-independiente-platform-design.md` (sección 3, "Autenticación y perfiles")

## Global Constraints

- No debe cambiar el comportamiento de Scout Platform para usuarios que YA tienen fila en `user_profiles` (hoy: `marcoscucho99@gmail.com` con `club_id = 'dobleg'`) — para ellos, `clubId` resuelve a `'dobleg'` y la app se ve exactamente igual que hoy.
- Todo el texto nuevo visible al usuario pasa por `t()` / `translations.ts`, en los 9 idiomas que ya soporta la app — no texto hardcodeado en español dentro del componente.
- El botón de cerrar sesión reusa la clave de traducción ya existente `nav.cerrarSesion` (no crear una nueva).
- El mock de Supabase en tests sigue el patrón de `src/services/agencyCoachesService.test.ts` (mock de `@/lib/supabase`, no de red real).

---

### Task 1: Servicio `getMyClubId`

**Files:**
- Create: `src/services/userProfileService.ts`
- Test: `src/services/userProfileService.test.ts`

**Interfaces:**
- Produces: `getMyClubId(userId: string): Promise<string | null>` — devuelve el `club_id` del usuario, o `null` si no tiene fila en `user_profiles` (o si hay error). Consumida por `AuthContext` en Task 2.

- [ ] **Step 1: Escribir el test (falla primero)**

```ts
// src/services/userProfileService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { getMyClubId } from './userProfileService'

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return builder
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('getMyClubId', () => {
  it('devuelve el club_id cuando el usuario tiene perfil', async () => {
    mockFrom.mockReturnValue(chain({ data: { club_id: 'dobleg' }, error: null }))
    expect(await getMyClubId('user-1')).toBe('dobleg')
  })

  it('devuelve null cuando el usuario no tiene fila en user_profiles', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }))
    expect(await getMyClubId('user-2')).toBeNull()
  })

  it('devuelve null si Supabase devuelve error', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: new Error('boom') }))
    expect(await getMyClubId('user-3')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/services/userProfileService.test.ts`
Expected: FAIL — `userProfileService.ts` todavía no existe.

- [ ] **Step 3: Implementar el servicio**

```ts
// src/services/userProfileService.ts
import { supabase } from '@/lib/supabase'

export async function getMyClubId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('club_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return (data as { club_id: string }).club_id
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/services/userProfileService.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/userProfileService.ts src/services/userProfileService.test.ts
git commit -m "feat(auth): agrega getMyClubId para resolver el club del usuario logueado"
```

---

### Task 2: Exponer `clubId` desde `AuthContext`

**Files:**
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: `getMyClubId(userId: string): Promise<string | null>` (Task 1).
- Produces: `useAuth()` ahora también devuelve `clubId: string | null | undefined` — consumido por `Layout.tsx` en Task 3.

- [ ] **Step 1: Agregar `clubId` al tipo `AuthState` y al estado del provider**

En `src/context/AuthContext.tsx`, agregar el import y el campo al tipo:

```ts
import { getMyClubId } from '@/services/userProfileService'
```

```ts
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  /** undefined = todavía resolviendo tras el login; null = sin fila en user_profiles (sin acceso); string = club_id real. */
  clubId: string | null | undefined
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithApple: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<{ error: Error | null }>
  userDisplayName: string
}
```

Dentro de `AuthProvider`, agregar el estado:

```ts
const [clubId, setClubId] = useState<string | null | undefined>(undefined)
```

- [ ] **Step 2: Resolver `clubId` cada vez que cambia el usuario**

Reemplazar el `useEffect` actual (el que llama a `getSession` y suscribe `onAuthStateChange`) por esta versión, que además resuelve el club:

```ts
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session)
    setUser(session?.user ?? null)
    setLoading(false)
    if (session?.user) {
      getMyClubId(session.user.id).then(setClubId)
    } else {
      setClubId(undefined)
    }
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session)
    setUser(session?.user ?? null)
    setLoading(false)
    if (session?.user) {
      getMyClubId(session.user.id).then(setClubId)
    } else {
      setClubId(undefined)
    }
  })

  return () => subscription.unsubscribe()
}, [])
```

- [ ] **Step 3: Exponer `clubId` en el value del provider**

```tsx
<AuthContext.Provider value={{ user, session, loading, clubId, signIn, signUp, signInWithGoogle, signInWithApple, signOut, deleteAccount, userDisplayName }}>
```

- [ ] **Step 4: Verificar que el proyecto sigue compilando**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `AuthContext.tsx` (`Layout.tsx` todavía no usa `clubId`, así que no hay consumidores rotos).

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat(auth): AuthContext resuelve y expone el club_id del usuario logueado"
```

---

### Task 3: Pantalla de "acceso no autorizado" en `Layout.tsx`

**Files:**
- Modify: `src/constants/translations.ts` (agrega 2 claves nuevas × 9 idiomas)
- Modify: `src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `clubId` de `useAuth()` (Task 2); `t()` de `useLanguage()` (ya existente en el proyecto).
- Produces: nada consumido por tasks posteriores de este plan — es la última pieza visible.

- [ ] **Step 1: Agregar las claves de traducción `unauthorized.titulo` / `unauthorized.mensaje` en los 9 idiomas**

En `src/constants/translations.ts`, agregar estas dos líneas inmediatamente después de la línea `'notFound.volver': "..."` de cada bloque de idioma (hay una por idioma — buscar cada una y agregar debajo):

```ts
    // Después de 'notFound.volver': "Volver a", (bloque es)
    'unauthorized.titulo': "Acceso no autorizado",
    'unauthorized.mensaje': "Tu cuenta todavía no tiene acceso a esta plataforma. Contactá al administrador para que te dé de alta.",
```

```ts
    // Después de 'notFound.volver': "Back to", (bloque en)
    'unauthorized.titulo': "Access not authorized",
    'unauthorized.mensaje': "Your account doesn't have access to this platform yet. Contact the administrator to get set up.",
```

```ts
    // Después de 'notFound.volver': "Geri dön:", (bloque tr)
    'unauthorized.titulo': "Erişim yetkisi yok",
    'unauthorized.mensaje': "Hesabınızın bu platforma henüz erişimi yok. Yetkilendirilmek için yöneticiyle iletişime geçin.",
```

```ts
    // Después de 'notFound.volver': "Torna a", (bloque it)
    'unauthorized.titulo': "Accesso non autorizzato",
    'unauthorized.mensaje': "Il tuo account non ha ancora accesso a questa piattaforma. Contatta l'amministratore per essere abilitato.",
```

```ts
    // Después de 'notFound.volver': "Retour à", (bloque fr)
    'unauthorized.titulo': "Accès non autorisé",
    'unauthorized.mensaje': "Votre compte n'a pas encore accès à cette plateforme. Contactez l'administrateur pour être autorisé.",
```

```ts
    // Después de 'notFound.volver': "Zurück zu", (bloque de)
    'unauthorized.titulo': "Zugriff nicht autorisiert",
    'unauthorized.mensaje': "Ihr Konto hat noch keinen Zugriff auf diese Plattform. Wenden Sie sich an den Administrator, um freigeschaltet zu werden.",
```

```ts
    // Después de 'notFound.volver': "العودة إلى", (bloque ar)
    'unauthorized.titulo': "الوصول غير مصرح به",
    'unauthorized.mensaje': "حسابك ليس لديه وصول إلى هذه المنصة بعد. تواصل مع المسؤول لتفعيل حسابك.",
```

```ts
    // Después de 'notFound.volver': "返回", (bloque zh)
    'unauthorized.titulo': "未授权访问",
    'unauthorized.mensaje': "您的账户尚无权访问此平台。请联系管理员为您开通权限。",
```

```ts
    // Después de 'notFound.volver': "に戻る", (bloque ja)
    'unauthorized.titulo': "アクセスが許可されていません",
    'unauthorized.mensaje': "このプラットフォームへのアクセス権がまだありません。管理者に連絡して権限を有効にしてもらってください。",
```

- [ ] **Step 2: Agregar los imports y el chequeo de `clubId` en `Layout.tsx`**

Agregar el import de `useLanguage` (junto a los imports existentes):

```ts
import { useLanguage } from '@/context/LanguageContext'
```

Cambiar la desestructuración del hook:

```ts
const { user, loading, clubId, signOut } = useAuth()
const { t } = useLanguage()
```

Inmediatamente después del bloque `if (!user) { ... }` (que devuelve la pantalla de login), agregar:

```tsx
  // Sesión resuelta pero el club todavía no se resolvió — mismo spinner que el loading inicial.
  if (clubId === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-50 dark:bg-apple-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-apple-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  // Usuario logueado sin fila en user_profiles: sin acceso a esta plataforma.
  if (clubId === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-apple-gray-50 dark:bg-apple-gray-900">
        <div className="w-24 h-24 bg-apple-gray-100 dark:bg-apple-gray-800 rounded-2xl flex items-center justify-center mb-6 shadow-apple dark:shadow-apple-dark">
          <svg className="w-12 h-12 text-apple-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-apple-gray-800 dark:text-white mb-2">{t('unauthorized.titulo')}</h1>
        <p className="text-sm text-apple-gray-500 dark:text-apple-gray-400 max-w-sm leading-relaxed mb-6">
          {t('unauthorized.mensaje')}
        </p>
        <button
          onClick={() => signOut()}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-apple-gray-700 dark:text-apple-gray-300 bg-apple-gray-100 dark:bg-apple-gray-700 hover:bg-apple-gray-200 dark:hover:bg-apple-gray-600 transition-colors"
        >
          {t('nav.cerrarSesion')}
        </button>
      </div>
    )
  }
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/constants/translations.ts src/components/layout/Layout.tsx
git commit -m "feat(auth): pantalla de acceso no autorizado para usuarios sin club asignado"
```

---

### Task 4: Verificación de regresión

**Files:** ninguno.

**Interfaces:** ninguna — task de verificación pura.

- [ ] **Step 1: Correr la suite completa**

Run: `npm test`
Expected: PASS (803 tests previos + los 3 nuevos de `userProfileService.test.ts` = 806).

- [ ] **Step 2: Smoke test como usuario de Doble G (con perfil)**

`npm run dev`, loguearse con `marcoscucho99@gmail.com` (ya tiene `club_id = 'dobleg'` desde el Plan 1). Confirmar: la app carga normal, sin pantalla de "acceso no autorizado", ningún cambio visible respecto de antes de este plan.

- [ ] **Step 3: Smoke test con una cuenta sin perfil (si hay una disponible)**

Loguearse con cualquier cuenta de Google que NO tenga fila en `user_profiles`. Confirmar que aparece la pantalla de "acceso no autorizado" con el botón de cerrar sesión, y que cerrar sesión funciona (vuelve a la pantalla de login). Si no hay una segunda cuenta de Google a mano para probar esto, se puede confirmar leyendo el código (Task 3) en vez de probarlo en vivo — no es bloqueante para el resto del plan.

No hay commit en este task (no genera archivos).

# Mercado — Negociaciones y Objetivos

## Contexto y objetivo

Doble G Sports Group tiene varios scouts/representantes negociando en paralelo con
clubes. Hoy no hay ningún registro compartido de con quién se habló, qué se ofreció,
en qué quedó, ni cuándo hay que retomar el contacto — lo que hace que dos personas
de la agencia puedan pisarse ofreciendo el mismo jugador al mismo club, o perder el
seguimiento de un "llamame en 10 días".

**Objetivo:** una página nueva, "Mercado", que sea el registro central de:
1. **Objetivos** — qué busca cada club (posición/perfil), sin necesidad de tener
   todavía un jugador puntual para ofrecer.
2. **Negociaciones** — una oferta concreta: tal jugador a tal club, con contacto,
   responsable, notas cronológicas y una fecha de "volver a hablar" que dispara
   una alerta.

Prioridad de diseño explícita del usuario: **estético pero simple** — la usan
personas grandes, no técnicas, en desktop/tablet/mobile por igual. Escudos de
clubes con sombra (fáciles de reconocer de un vistazo), foto del jugador cuando
está identificado en la API. El usuario va a entrar seguido a sumar contexto
(por ejemplo, decir qué jugador de la API corresponde a una negociación que
arrancó solo con un nombre) — el flujo de edición incremental importa tanto
como el de alta.

## Alcance de esta spec

Incluye: modelo de datos, página Mercado (Objetivos + Negociaciones, alta, detalle,
notas, reasignación), alertas (campanita + franja destacada), reestructuración de
navbar (agregar "Mercado", anidar "Entrenadores" bajo "Scout Interno").

No incluye (explícitamente fuera de alcance por ahora, el usuario no lo pidió):
email/push de las alertas, cron de servidor — las alertas se calculan al cargar
la página, en el cliente, igual que el resto de la app.

## Modelo de datos

### `market_team_members` (para el selector de responsable)

No existe hoy ninguna lista de "personas de la agencia" consultable desde el
cliente — el resto de la app solo registra "quién hizo esta acción" (vía
`useAuth()`), nunca "a quién se le puede asignar algo". Se necesita para poder
elegir un responsable de una lista (no texto libre, que se llena de variantes
de escritura del mismo nombre) y para reasignar a otra persona.

```sql
CREATE TABLE public.market_team_members (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Mismo espíritu que `agencyPlayers.ts` + `agency_players` (lista chica,
mantenida a mano cuando entra o sale alguien del equipo) pero para personas,
no jugadores. `assigned_to_id` en las tablas de abajo referencia
`market_team_members.id`; `assigned_to_name` queda como snapshot de texto para
que el historial no se rompa si alguien cambia de nombre o se da de baja.

### Clubes: se reutiliza `teams`, no hay tabla nueva

`teams` ya existe (sincronizada desde API-Football: `id`, `name`, `logo`,
`league_id`) y ya es una lista curada y mantenida sin esfuerzo extra de la
agencia — cumple el pedido de "lista curada" sin crear otro catálogo a mano.
Elegir un club en Mercado es buscar en `teams`, igual que ya se hace en
`ClubsAndCupsSection`.

### `market_club_needs` (Objetivos)

```sql
CREATE TABLE public.market_club_needs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id           BIGINT NOT NULL,              -- FK conceptual a teams.id (sin FK dura: teams se resincroniza)
  team_name         TEXT NOT NULL,                 -- snapshot, para no depender de un join si teams cambia
  team_logo         TEXT,                           -- snapshot del logo al momento de crear
  position_label    TEXT NOT NULL,                 -- ej. "Lateral derecho", texto libre corto
  status            TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado')),
  assigned_to_id     UUID,                          -- auth.users.id
  assigned_to_name   TEXT,
  next_followup_date DATE,
  created_by_id      UUID,
  created_by_name    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `market_negotiations`

```sql
CREATE TABLE public.market_negotiations (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id             BIGINT NOT NULL,
  team_name           TEXT NOT NULL,
  team_logo           TEXT,
  player_name         TEXT NOT NULL,               -- siempre requerido, aunque sea "el 9 de tal club" al principio
  player_api_id       BIGINT,                       -- nullable: se completa cuando se identifica en la API
  player_source       TEXT CHECK (player_source IN ('interno', 'externo')),  -- de qué roster viene, si aplica
  contact_name        TEXT,
  contact_role        TEXT,                          -- "cargo"
  status              TEXT NOT NULL DEFAULT 'contactado'
                        CHECK (status IN ('contactado', 'reunion', 'oferta_enviada', 'en_espera', 'cerrado_exitoso', 'cerrado_rechazado')),
  assigned_to_id       UUID,
  assigned_to_name     TEXT,
  next_followup_date   DATE,
  created_by_id        UUID,
  created_by_name      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Foto del jugador: si `player_api_id` está seteado, se construye
`https://media.api-sports.io/football/players/{player_api_id}.png` (mismo patrón
ya usado en el resto de la app) — no hace falta join, con fallback a avatar
genérico (`PlayerPhoto`) si la imagen falla.

### `market_negotiation_notes` (timeline — cubre notas y reuniones)

```sql
CREATE TABLE public.market_negotiation_notes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negotiation_id  BIGINT REFERENCES public.market_negotiations(id) ON DELETE CASCADE,
  need_id         BIGINT REFERENCES public.market_club_needs(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_meeting      BOOLEAN NOT NULL DEFAULT false,   -- "cuántas reuniones tuvieron" = count(is_meeting=true)
  is_system       BOOLEAN NOT NULL DEFAULT false,    -- nota automática (ej. reasignación), se muestra distinta
  author_id       UUID,
  author_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (negotiation_id IS NOT NULL OR need_id IS NOT NULL)  -- pertenece a una negociación o a un objetivo, no ambas
);
```

Agregar una nota con fecha de seguimiento actualiza
`next_followup_date` en la negociación/objetivo padre (mismo paso, un solo
formulario: "nota" + campo opcional "volver a hablar el...").

Reasignar responsable = update de `assigned_to_id`/`assigned_to_name` +
insert automático de una nota `is_system=true` ("Juan se lo pasó a María")
para que quede rastro sin que nadie tenga que escribirlo.

RLS: mismo patrón que `manual_external_players` — lectura para todos,
escritura para `authenticated`.

## Alertas

Calculadas en el cliente al cargar datos (sin cron ni email):
- **Campanita en el navbar**: contador de negociaciones + objetivos con
  `assigned_to_id = usuario actual` y `next_followup_date <= hoy`. Click navega
  a Mercado.
- **Franja en Mercado**: todo el equipo, no solo lo propio — para que si algo se
  cae, cualquiera lo note, no solo el responsable. Vencidos primero (rojo), luego
  "vence en ≤3 días" (ámbar).

## Página Mercado

Diseño con tarjetas (no tablas densas) — pensado para gente grande en mobile:

- **Franja de alertas** arriba de todo (colapsable si no hay nada vencido).
- **Dos pestañas**: "Negociaciones" y "Objetivos".
- **Tarjeta de negociación**: escudo del club (`TeamLogo`, con sombra —
  `drop-shadow-md`), nombre del club, foto del jugador si `player_api_id` está
  seteado (`PlayerPhoto`) + nombre, contacto + cargo, responsable, badge de
  estado, fecha de próximo seguimiento, preview de la última nota.
- **Tarjeta de objetivo**: escudo del club, posición buscada, responsable,
  estado, fecha de seguimiento.
- **Detalle** (click en una tarjeta): timeline completo de notas (más nueva
  arriba, mismo patrón visual que los comentarios de jugador ya existentes),
  formulario simple para agregar nota (+ checkbox "fue una reunión" + fecha
  opcional de seguimiento), botón "Reasignar", y — clave para el uso que el
  usuario describió — un botón "Vincular jugador de la API" siempre visible y
  fácil de encontrar, para completar `player_api_id` en cualquier momento
  después del alta (buscador de jugador reutilizado del resto de la app).
- **Alta**: formulario corto — club (buscador sobre `teams`), jugador (nombre
  libre + buscador opcional para vincular a la API ya desde el alta si se sabe),
  contacto + cargo, responsable (default: quien está creando).
- **Filtros**: por club, por responsable, por estado, "solo vencidos".

## Navbar

- Nuevo item "Mercado" entre "Inicio" y "Scout Externo" (`directLinks`).
- "Entrenadores" deja de ser link directo y pasa a sub-ítem del grupo
  "Scout Interno" (que hoy es un link directo y pasa a ser un `NavGroup` tipo
  dropdown, con "Scout Interno" como ítem propio + "Entrenadores" al lado,
  mismo patrón que el dropdown de "Inicio").

## Casos borde

- Negociación sin `player_api_id` todavía: se muestra el avatar genérico de
  `PlayerPhoto`, sin romper el layout — es el estado esperado al principio.
- `player_api_id` con foto que falla (404): fallback automático ya lo maneja
  `PlayerPhoto`.
- Club sin logo en `teams` (poco común): `TeamLogo` ya devuelve `null` en ese
  caso — el layout de la tarjeta no debe depender de que el logo exista.
- Cerrar una negociación (`cerrado_exitoso`/`cerrado_rechazado`): deja de contar
  para alertas aunque tenga `next_followup_date` vencida — el filtro de alertas
  excluye siempre los estados `cerrado_*`.

## Testing

- Funciones puras testeables: cálculo de alertas (dado un array de
  negociaciones/objetivos + fecha "hoy", devolver vencidos/por vencer),
  conteo de reuniones desde notas, construcción de URL de foto desde
  `player_api_id`.
- Resto: verificación manual en navegador (alta, nota, reasignación, alerta,
  responsive mobile/tablet) — no hay lógica de negocio compleja que amerite
  más unit tests que eso.

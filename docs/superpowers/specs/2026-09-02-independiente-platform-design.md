# Plataforma Independiente (clon de Scout Platform, Supabase compartido)

## Contexto

Doble G Sports Group quiere una segunda plataforma, para uso interno del Club Atlético Independiente (cuerpo técnico, dirigentes), clonando el diseño y las funcionalidades de Scout Platform (esta app). El scouting externo (mercado, valores, rankings de jugadores no vinculados a un club) sigue siendo el mismo pool de datos que hoy usa Doble G — no le pertenece a un club, así que se comparte tal cual. Todo lo "interno" (plantel, entrenadores de primera/reserva/informes, seguimiento, negociaciones, video análisis, GPS) es específico de cada club y **no debe mezclarse** entre Doble G e Independiente, aunque ambas plataformas corran sobre el mismo proyecto Supabase (`qgwmxjjumauortbwvivu`).

Decisiones ya tomadas con el usuario:
- Copia completa del repo a una carpeta nueva, con su propio git y su propio deploy — desarrollo 100% independiente de acá en más.
- Mismo proyecto Supabase para las dos plataformas (mismas `SUPABASE_URL`/keys).
- Aislamiento de datos internos por club dentro de las mismas tablas (no tablas duplicadas por club).
- Usuarios y accesos separados — gente de Independiente nunca ve datos de Doble G.
- El plantel de primera de Independiente sale de API-Football (mismo patrón que ya usa la app hoy para scouting externo). Reserva, inferiores, juveniles y femenino **no** están en la API — los carga a mano la gente del club, no Google Sheets.
- Se mantiene el login con Google (y Apple) tal cual existe hoy.
- Alta de usuarios de Independiente: manual (vos/alguien del club los da de alta en `user_profiles`), no auto-registro — ver sección 3.

## 1. Repos y deploy

- Copio el working tree completo a una carpeta nueva (ej. `independiente-platform`), inicializo un repo git nuevo (`git init`, primer commit), y creo un remoto nuevo en GitHub bajo el usuario/organización que indique `marcoscucho99@gmail.com` cuando se llegue a ese paso.
- Deploy nuevo en Netlify (sitio nuevo, dominio propio tipo `independiente-scouting.netlify.app` o el que se elija), con sus propias env vars apuntando al **mismo** Supabase.
- `.env` de la carpeta nueva usa las mismas `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` que Scout Platform — es el mismo proyecto Supabase.
- Netlify Functions (`sheets` proxy, `delete-account`, etc.) se copian tal cual; el proxy de Google Sheets solo lo sigue usando la parte de scouting externo (compartida).

## 2. Modelo de datos: compartido vs. por club

**Criterio:** una tabla es *compartida* si sus filas no pertenecen a un club (son datos de mercado/scouting externo, o catálogos de referencia). Es *por club* si sus filas son propiedad de un club específico (plantel propio, cuerpo técnico, seguimiento interno, negociaciones, video, GPS).

Clasificación de las tablas actuales (a confirmar/ajustar en el plan de implementación con una pasada completa del esquema):

- **Compartidas, sin cambios:** `players`, `teams`, `leagues`, `fixtures`, `player_match_stats`, `player_season_scores`, `market_value_history`, `manual_external_players`, `gps_metrics`, `gps_metric_aliases`, `sync_log`.
- **Por club → se les agrega `club_id text not null default 'dobleg'`:** `agency_classifications`, `agency_classification_history`, `agency_players`, `agency_coaches`, `agency_manual_fixtures`, `coach_future_squads`, `coach_match_notes`, `coach_match_team_stats`, `coach_tactical_boards`, `coach_training_sessions`, `coach_video_analysis_buckets`, `coach_video_analysis_matches`, `market_negotiations`, `market_negotiation_notes`, `market_club_needs`, `market_need_candidates`, `market_team_members`, `gps_entries`, `player_videos`.

El `default 'dobleg'` hace que el backfill de filas existentes sea automático (todas las filas de hoy son de Doble G) y que Scout Platform no tenga que cambiar una sola línea de código para seguir funcionando: sigue escribiendo sin `club_id` y le queda `'dobleg'` solo. La carpeta nueva sí manda `club_id: 'independiente'` explícito en cada insert/update.

**RLS:** hoy las políticas de las tablas internas son permisivas (`USING (true)` para lectura, cualquier usuario autenticado puede escribir). Eso deja de alcanzar en cuanto hay dos clientes reales en el mismo proyecto. Se reemplazan por políticas que comparan `club_id` contra el club del usuario autenticado (ver sección 3):

```sql
CREATE POLICY "club_read" ON public.agency_classifications
  FOR SELECT USING (club_id = current_club_id());
CREATE POLICY "club_write" ON public.agency_classifications
  FOR ALL TO authenticated USING (club_id = current_club_id()) WITH CHECK (club_id = current_club_id());
```

`current_club_id()` es una función SQL que lee el `club_id` desde una tabla `user_profiles (user_id, club_id)`. Es la única pieza de esquema realmente nueva; todo lo demás es agregar una columna a tablas existentes.

## 3. Autenticación y perfiles

Mismo proyecto Supabase Auth → el login con Google/Apple sigue funcionando en la carpeta nueva sin tocar código de `AuthContext.tsx`; solo hay que agregar el dominio nuevo de Netlify a las redirect URLs permitidas en Supabase Auth y en el client ID de Google Cloud.

Se agrega:
- Tabla `user_profiles (user_id uuid primary key references auth.users, club_id text not null)`.
- Alta de perfil: **manual**, no auto-registro. Vos (o alguien designado del club) insertás la fila en `user_profiles` con el email/`user_id` y `club_id` correspondiente antes de que esa persona pueda entrar. Evita que cualquier cuenta de Gmail entre a ver datos del club con solo loguearse. Login sin perfil → pantalla de "acceso no autorizado, contactar al administrador" en vez de entrar a la app.
- Cada plataforma, al loguear, filtra/escribe usando el `club_id` del perfil — no hace falta que el usuario elija club a mano.

## 4. Plantel de Independiente: API-Football (primera) + carga manual (el resto)

Solo la Primera de Independiente existe como equipo en API-Football. Reserva, inferiores (sub-20, sub-17, etc.), juveniles y femenino no están en la API — los va a cargar a mano la gente del club. Esto da dos fuentes conviviendo en la misma tabla:

- **Primera:** se reutiliza el patrón ya existente (`club_team_id`, edge functions `sync-player-stats` y `enrich-player` que ya hablan con API-Football) — se busca el `team_id` de Independiente y se sincroniza el plantel a `agency_players` con `club_id = 'independiente'`, `category = 'primera'`, `source = 'api_football'`, con el mismo mecanismo de sync periódico que hoy alimenta el scouting externo.
- **Reserva / inferiores / juveniles / femenino:** filas en la misma tabla `agency_players` con `club_id = 'independiente'`, `category = 'reserva' | 'sub-20' | ... | 'femenino'`, `source = 'manual'`. Se agrega una columna `category text` (no existe hoy) y una pantalla simple de carga/edición para que la gente del club dé de alta jugadores a mano (nombre, posición, fecha de nacimiento — los mismos campos que ya administra `agency_players` para Doble G, reutilizando el CRUD/formulario existente en vez de construir uno nuevo).
- Todas las pantallas que hoy listan/filtran el plantel (ficha de entrenador, plantel futuro, etc.) filtran también por `category` cuando corresponda, para poder ver "solo primera" o "todo el club".

## 5. Branding

En la carpeta nueva: paleta roja/blanca/negra de Independiente (usando el escudo que mandó el usuario como referencia), y reemplazo de menciones a "Doble G Sports Group" por el naming que corresponda a Independiente donde el texto es específico de agencia (no donde es genérico de la plataforma).

## 6. Orden de migración (Supabase, aplica a ambas apps)

1. Migración SQL: crear `user_profiles` + `current_club_id()`.
2. Migración SQL: `ALTER TABLE ... ADD COLUMN club_id text NOT NULL DEFAULT 'dobleg'` en cada tabla "por club" listada arriba (no rompe Scout Platform — sigue sin mandar `club_id`).
3. Migración SQL: reemplazar policies permisivas por las que filtran por `current_club_id()`.
4. Alta manual de los usuarios de Doble G en `user_profiles` con `club_id = 'dobleg'`.
5. Recién ahí clonar la carpeta — para que la copia nazca ya con el modelo multi-club funcionando, en vez de clonar primero y migrar después.

Los pasos 1-3 se aplican una sola vez, sobre el Supabase compartido, y quedan viviendo en `supabase/migrations/` de Scout Platform (este repo) porque son schema del proyecto compartido. La carpeta de Independiente los hereda porque clona el repo en el paso 5.

## Riesgos abiertos

- **`team_id` de Independiente (Primera) en API-Football:** hay que confirmarlo antes de armar el sync — es el primer paso técnico del lado de Independiente. Reserva/inferiores/juveniles/femenino no dependen de esto (carga manual).
- **Pantalla de carga manual de plantel:** hay que definir permisos (quién del club puede cargar/editar jugadores de cada categoría) — probablemente todos los usuarios con `club_id = 'independiente'` pueden, sin roles más finos por ahora, dado que van a ser pocas cuentas.
- **Clasificación tabla por tabla:** la lista de la sección 2 es la mejor lectura de las migraciones actuales; antes de escribir las migraciones se hace una pasada final confirmando que ninguna tabla quedó mal clasificada (por ejemplo si alguna tabla "compartida" en realidad guarda algo agency-specific que no se ve por el nombre).

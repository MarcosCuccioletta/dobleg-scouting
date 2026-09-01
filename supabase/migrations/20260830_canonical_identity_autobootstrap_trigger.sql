-- Fase 8 (prevenir recurrencia): hasta ahora la capa canónica
-- (player_identities/player_external_ids, team_identities/team_external_ids)
-- solo se rellenó una vez, a mano, para las filas que ya existían. Cualquier
-- jugador/equipo nuevo insertado por sync-sofascore/sync.py o por
-- enrich-player de acá en adelante quedaba SIN identidad canónica propia —
-- exactamente el mismo agujero que causó los duplicados que se sanearon hoy.
--
-- Este trigger cierra ese agujero: cada vez que se inserta una fila nueva en
-- `players` o `teams`, se le crea automáticamente su propia identidad 1:1
-- (confidence='single', igual que hacía el bootstrap manual). No fusiona
-- nada ni intenta adivinar si ya existe la misma persona/club del otro
-- proveedor — eso lo sigue haciendo, con evidencia real (transfermarkt_id +
-- fecha de nacimiento exacta, o nombre+liga para equipos), la consolidación
-- por lotes que ya corrió hoy y se puede volver a correr periódicamente.
-- Efecto práctico: de acá en adelante NINGÚN players.id/teams.id nuevo queda
-- sin su fila en la capa canónica (invariante del saneamiento), así que la
-- consolidación futura no necesita re-bootstrapear, solo re-clasificar.
--
-- No toca sync.py ni enrich-player — no había que cambiar cómo escriben,
-- solo agregar el registro en la capa canónica que faltaba.

create or replace function public.bootstrap_new_player_identity()
returns trigger
language plpgsql
as $function$
declare
  new_identity_id bigint;
  src text;
begin
  if exists (select 1 from player_external_ids where players_row_id = NEW.id) then
    return NEW;
  end if;

  src := case
    when NEW.id >= 99000000 then 'legacy_agency'
    when NEW.id >= 20000000 then 'sofascore'
    else 'api_football'
  end;

  insert into player_identities default values returning id into new_identity_id;
  insert into player_external_ids (player_identity_id, source, external_id, players_row_id)
  values (new_identity_id, src, NEW.id, NEW.id);

  return NEW;
end;
$function$;

drop trigger if exists trg_bootstrap_new_player_identity on players;
create trigger trg_bootstrap_new_player_identity
after insert on players
for each row execute function bootstrap_new_player_identity();

create or replace function public.bootstrap_new_team_identity()
returns trigger
language plpgsql
as $function$
declare
  new_identity_id bigint;
  src text;
begin
  if exists (select 1 from team_external_ids where teams_row_id = NEW.id) then
    return NEW;
  end if;

  src := case
    when NEW.id >= 99000000 then 'legacy_agency'
    when NEW.id >= 20000000 then 'sofascore'
    else 'api_football'
  end;

  insert into team_identities default values returning id into new_identity_id;
  insert into team_external_ids (team_identity_id, source, external_id, teams_row_id)
  values (new_identity_id, src, NEW.id, NEW.id);

  return NEW;
end;
$function$;

drop trigger if exists trg_bootstrap_new_team_identity on teams;
create trigger trg_bootstrap_new_team_identity
after insert on teams
for each row execute function bootstrap_new_team_identity();

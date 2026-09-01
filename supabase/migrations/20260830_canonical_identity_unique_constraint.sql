-- Etapa D (antes deferida hasta validar que no había duplicados existentes
-- de (source, external_id) — se validó recién, 0 filas duplicadas). Con esto
-- ya no es posible insertar dos veces el mismo external_id del mismo
-- proveedor en la capa canónica, ni por el trigger de auto-bootstrap ni por
-- ningún script futuro — Postgres lo rechaza directo en vez de permitir que
-- se cuele un duplicado silencioso.

alter table player_external_ids
  add constraint player_external_ids_source_external_id_key unique (source, external_id);

alter table team_external_ids
  add constraint team_external_ids_source_external_id_key unique (source, external_id);

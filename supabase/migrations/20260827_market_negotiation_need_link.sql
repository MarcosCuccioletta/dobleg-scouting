-- Vincula negociaciones con búsquedas de club: hoy son dos tablas totalmente
-- independientes. Ofrecer un jugador a un club debe engancharse (o crear) la
-- búsqueda de ese club para esa posición, y mostrar el jugador como candidato.

alter table market_negotiations add column if not exists position_label text;
alter table market_negotiations add column if not exists need_id bigint references market_club_needs(id) on delete set null;

alter table market_need_candidates add column if not exists negotiation_id bigint references market_negotiations(id) on delete set null;

create index if not exists market_negotiations_need_id_idx on market_negotiations(need_id);
create index if not exists market_need_candidates_negotiation_id_idx on market_need_candidates(negotiation_id);

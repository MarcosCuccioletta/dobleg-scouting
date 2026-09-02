-- El default fijo 'dobleg' (Task 2 del fundamento multi-club) sirvió para el backfill inicial,
-- pero deja un hueco: cualquier pantalla que inserte sin mandar club_id explícito (ninguna lo
-- hace hoy — es código escrito antes de que club_id existiera) cae en 'dobleg' sin importar
-- quién esté logueado. Encontrado al revisar los widgets de "agregar a seguimiento/cartera"
-- en el clon de Independiente: sin este fix, un usuario de Independiente podía escribir por
-- accidente en tablas de Doble G. Cambiamos el default a current_club_id(), que resuelve
-- dinámicamente el club del usuario que hace el insert — mismo resultado para Doble G hoy
-- (sigue resolviendo 'dobleg'), pero ahora correcto también para Independiente y para
-- cualquier pantalla futura que nadie audite a mano.

ALTER TABLE public.agency_classifications        ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.agency_classification_history  ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.agency_players                  ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.agency_coaches                  ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.agency_manual_fixtures          ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_future_squads             ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_match_notes               ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_match_team_stats          ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_tactical_boards           ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_training_sessions         ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_video_analysis_buckets    ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.coach_video_analysis_matches    ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.market_negotiations             ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.market_negotiation_notes        ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.market_club_needs               ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.market_need_candidates          ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.market_team_members             ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.gps_entries                     ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.player_videos                   ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.scout_players                   ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.scout_players_status            ALTER COLUMN club_id SET DEFAULT public.current_club_id();
ALTER TABLE public.club_squads                     ALTER COLUMN club_id SET DEFAULT public.current_club_id();

-- Cada tabla "interna" (propiedad de un club, no del pool de scouting/mercado compartido)
-- suma club_id. DEFAULT 'dobleg' hace que las filas existentes (todas de Doble G) queden
-- clasificadas solas, y que Scout Platform siga funcionando sin cambiar código de la app.

ALTER TABLE public.agency_classifications        ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_classification_history  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_players                  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_coaches                  ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.agency_manual_fixtures          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_future_squads             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_match_notes               ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_match_team_stats          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_tactical_boards           ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_training_sessions         ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_video_analysis_buckets    ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.coach_video_analysis_matches    ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_negotiations             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_negotiation_notes        ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_club_needs               ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_need_candidates          ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.market_team_members             ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.gps_entries                     ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';
ALTER TABLE public.player_videos                   ADD COLUMN IF NOT EXISTS club_id TEXT NOT NULL DEFAULT 'dobleg';

CREATE INDEX IF NOT EXISTS idx_agency_classifications_club       ON public.agency_classifications(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_classification_history_club ON public.agency_classification_history(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_players_club                ON public.agency_players(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_coaches_club                ON public.agency_coaches(club_id);
CREATE INDEX IF NOT EXISTS idx_agency_manual_fixtures_club        ON public.agency_manual_fixtures(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_future_squads_club           ON public.coach_future_squads(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_match_notes_club             ON public.coach_match_notes(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_match_team_stats_club        ON public.coach_match_team_stats(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_tactical_boards_club         ON public.coach_tactical_boards(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_training_sessions_club       ON public.coach_training_sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_video_analysis_buckets_club  ON public.coach_video_analysis_buckets(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_video_analysis_matches_club  ON public.coach_video_analysis_matches(club_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiations_club           ON public.market_negotiations(club_id);
CREATE INDEX IF NOT EXISTS idx_market_negotiation_notes_club      ON public.market_negotiation_notes(club_id);
CREATE INDEX IF NOT EXISTS idx_market_club_needs_club             ON public.market_club_needs(club_id);
CREATE INDEX IF NOT EXISTS idx_market_need_candidates_club        ON public.market_need_candidates(club_id);
CREATE INDEX IF NOT EXISTS idx_market_team_members_club           ON public.market_team_members(club_id);
CREATE INDEX IF NOT EXISTS idx_gps_entries_club                   ON public.gps_entries(club_id);
CREATE INDEX IF NOT EXISTS idx_player_videos_club                 ON public.player_videos(club_id);

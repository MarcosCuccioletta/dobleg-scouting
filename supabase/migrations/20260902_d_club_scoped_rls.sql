-- Reemplaza las policies permisivas ("cualquiera lee, cualquier logueado escribe") de las
-- tablas internas por policies que exigen club_id = current_club_id(). A partir de acá,
-- un usuario sin login o con el club_id equivocado no ve ni puede escribir estas filas.

-- agency_classifications
DROP POLICY IF EXISTS "read_agency_classifications" ON public.agency_classifications;
CREATE POLICY "read_agency_classifications" ON public.agency_classifications
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_classifications" ON public.agency_classifications;
CREATE POLICY "write_agency_classifications" ON public.agency_classifications
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_classification_history
DROP POLICY IF EXISTS "read_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "read_agency_classification_history" ON public.agency_classification_history
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_classification_history" ON public.agency_classification_history;
CREATE POLICY "write_agency_classification_history" ON public.agency_classification_history
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_players
DROP POLICY IF EXISTS "read_agency_players" ON public.agency_players;
CREATE POLICY "read_agency_players" ON public.agency_players
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_players" ON public.agency_players;
CREATE POLICY "write_agency_players" ON public.agency_players
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_coaches
DROP POLICY IF EXISTS "read_agency_coaches" ON public.agency_coaches;
CREATE POLICY "read_agency_coaches" ON public.agency_coaches
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_coaches" ON public.agency_coaches;
CREATE POLICY "write_agency_coaches" ON public.agency_coaches
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- agency_manual_fixtures
DROP POLICY IF EXISTS "read_agency_manual_fixtures" ON public.agency_manual_fixtures;
CREATE POLICY "read_agency_manual_fixtures" ON public.agency_manual_fixtures
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_agency_manual_fixtures" ON public.agency_manual_fixtures;
CREATE POLICY "write_agency_manual_fixtures" ON public.agency_manual_fixtures
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_future_squads
DROP POLICY IF EXISTS "read_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "read_coach_future_squads" ON public.coach_future_squads
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_future_squads" ON public.coach_future_squads;
CREATE POLICY "write_coach_future_squads" ON public.coach_future_squads
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_match_notes
DROP POLICY IF EXISTS "read_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "read_coach_match_notes" ON public.coach_match_notes
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_match_notes" ON public.coach_match_notes;
CREATE POLICY "write_coach_match_notes" ON public.coach_match_notes
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_match_team_stats
DROP POLICY IF EXISTS "read_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "read_coach_match_team_stats" ON public.coach_match_team_stats
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_match_team_stats" ON public.coach_match_team_stats;
CREATE POLICY "write_coach_match_team_stats" ON public.coach_match_team_stats
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_tactical_boards
DROP POLICY IF EXISTS "read_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "read_coach_tactical_boards" ON public.coach_tactical_boards
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_tactical_boards" ON public.coach_tactical_boards;
CREATE POLICY "write_coach_tactical_boards" ON public.coach_tactical_boards
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_training_sessions
DROP POLICY IF EXISTS "read_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "read_coach_training_sessions" ON public.coach_training_sessions
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_coach_training_sessions" ON public.coach_training_sessions;
CREATE POLICY "write_coach_training_sessions" ON public.coach_training_sessions
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_video_analysis_buckets
DROP POLICY IF EXISTS "read_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "read_cvab" ON public.coach_video_analysis_buckets
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "write_cvab" ON public.coach_video_analysis_buckets
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- coach_video_analysis_matches
DROP POLICY IF EXISTS "read_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "read_cvam" ON public.coach_video_analysis_matches
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "write_cvam" ON public.coach_video_analysis_matches
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_negotiations
DROP POLICY IF EXISTS "read_market_negotiations" ON public.market_negotiations;
CREATE POLICY "read_market_negotiations" ON public.market_negotiations
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_negotiations" ON public.market_negotiations;
CREATE POLICY "write_market_negotiations" ON public.market_negotiations
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_negotiation_notes
DROP POLICY IF EXISTS "read_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "read_market_negotiation_notes" ON public.market_negotiation_notes
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_negotiation_notes" ON public.market_negotiation_notes;
CREATE POLICY "write_market_negotiation_notes" ON public.market_negotiation_notes
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_club_needs
DROP POLICY IF EXISTS "read_market_club_needs" ON public.market_club_needs;
CREATE POLICY "read_market_club_needs" ON public.market_club_needs
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_club_needs" ON public.market_club_needs;
CREATE POLICY "write_market_club_needs" ON public.market_club_needs
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_need_candidates
DROP POLICY IF EXISTS "read_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "read_market_need_candidates" ON public.market_need_candidates
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_need_candidates" ON public.market_need_candidates;
CREATE POLICY "write_market_need_candidates" ON public.market_need_candidates
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- market_team_members
DROP POLICY IF EXISTS "read_market_team_members" ON public.market_team_members;
CREATE POLICY "read_market_team_members" ON public.market_team_members
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_market_team_members" ON public.market_team_members;
CREATE POLICY "write_market_team_members" ON public.market_team_members
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- gps_entries
DROP POLICY IF EXISTS "read_gps_entries" ON public.gps_entries;
CREATE POLICY "read_gps_entries" ON public.gps_entries
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_gps_entries" ON public.gps_entries;
CREATE POLICY "write_gps_entries" ON public.gps_entries
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

-- player_videos
DROP POLICY IF EXISTS "read_player_videos" ON public.player_videos;
CREATE POLICY "read_player_videos" ON public.player_videos
  FOR SELECT TO authenticated USING (club_id = public.current_club_id());
DROP POLICY IF EXISTS "write_player_videos" ON public.player_videos;
CREATE POLICY "write_player_videos" ON public.player_videos
  FOR ALL TO authenticated USING (club_id = public.current_club_id()) WITH CHECK (club_id = public.current_club_id());

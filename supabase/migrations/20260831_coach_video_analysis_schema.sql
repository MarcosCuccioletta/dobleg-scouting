-- supabase/migrations/20260831_coach_video_analysis_schema.sql

CREATE TABLE IF NOT EXISTS public.coach_video_analysis_buckets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coach_key   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('propio', 'rival')),
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvab_coach ON public.coach_video_analysis_buckets(coach_key);

CREATE TABLE IF NOT EXISTS public.coach_video_analysis_matches (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id          BIGINT NOT NULL REFERENCES public.coach_video_analysis_buckets(id) ON DELETE CASCADE,
  match_date         DATE NOT NULL,
  opponent_name      TEXT,
  instances          JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_storage_path TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cvam_bucket ON public.coach_video_analysis_matches(bucket_id);

ALTER TABLE public.coach_video_analysis_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_video_analysis_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "read_cvab" ON public.coach_video_analysis_buckets FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_cvab" ON public.coach_video_analysis_buckets;
CREATE POLICY "write_cvab" ON public.coach_video_analysis_buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "read_cvam" ON public.coach_video_analysis_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "write_cvam" ON public.coach_video_analysis_matches;
CREATE POLICY "write_cvam" ON public.coach_video_analysis_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket de Storage para los videos de partido, publico (mismo modelo que
-- 'informes-compartidos'): la ruta de cada objeto incluye bucketId/matchId,
-- no es adivinable ni listable sin conocer esos ids.
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-video-analysis', 'coach-video-analysis', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "coach_video_analysis_insert" ON storage.objects;
CREATE POLICY "coach_video_analysis_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_update" ON storage.objects;
CREATE POLICY "coach_video_analysis_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis')
  WITH CHECK (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_read" ON storage.objects;
CREATE POLICY "coach_video_analysis_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis');

DROP POLICY IF EXISTS "coach_video_analysis_delete" ON storage.objects;
CREATE POLICY "coach_video_analysis_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'coach-video-analysis');

-- Deployed pay scope: cutoff may cover one or many Directory Sites (client_branches).
-- Single-Site keeps cutoff_periods.branch_id; multi-Site leaves it null and uses this junction.

CREATE TABLE IF NOT EXISTS public.cutoff_period_sites (
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES directory.client_branches (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cutoff_period_id, branch_id)
);

CREATE INDEX IF NOT EXISTS cutoff_period_sites_branch_id_idx
  ON public.cutoff_period_sites (branch_id);

COMMENT ON TABLE public.cutoff_period_sites IS
  'Sites included on a Deployed cutoff. One row = pay separately; many rows = pay together. A Site may appear in at most one Regular cutoff per client+dates (enforced in API).';

-- Backfill from legacy single-site column.
INSERT INTO public.cutoff_period_sites (cutoff_period_id, branch_id)
SELECT id, branch_id
FROM public.cutoff_periods
WHERE branch_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.cutoff_period_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY cutoff_period_sites_select_authenticated ON public.cutoff_period_sites
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY cutoff_period_sites_manage_admin_hr ON public.cutoff_period_sites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'hr')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cutoff_period_sites TO authenticated;
GRANT ALL ON public.cutoff_period_sites TO service_role;

NOTIFY pgrst, 'reload schema';

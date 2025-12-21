-- =====================================================
-- 110: Remove Payslip Approval Workflow
-- =====================================================
-- Remove approval-related fields and constraints
-- Admin/HR can directly save payslips without approval
-- =====================================================

-- Drop approval-related columns
-- Note: We'll keep them for now but make them truly optional
-- Actually, let's remove them since there's no approval workflow
ALTER TABLE public.payslips 
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;

-- Update status constraint to remove 'approved' status
-- Keep only 'draft' and 'paid' since there's no approval workflow
ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_status_check;

ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_status_check 
  CHECK (status IN ('draft', 'paid'));

-- Update default status to 'draft' (already the default, but ensure it's correct)
ALTER TABLE public.payslips
  ALTER COLUMN status SET DEFAULT 'draft';

-- Drop the "Only Admins can approve payslips" policy since there's no approval workflow
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;

-- Ensure the main UPDATE policy allows admin/hr to update any status
-- The existing "Admin/HR can update payslips" policy should handle all updates now



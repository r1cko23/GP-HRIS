-- Head of accounting approves the overtime groups she is assigned to.
-- Same manager step as approver. She does not see every employee the way HR does.

CREATE OR REPLACE FUNCTION public.is_group_approver_role(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT p_role IN ('approver', 'head_of_accounting');
$$;

CREATE OR REPLACE FUNCTION public.is_group_queue_role(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT p_role IN ('approver', 'viewer', 'head_of_accounting');
$$;

GRANT EXECUTE ON FUNCTION public.is_group_approver_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_queue_role(text) TO authenticated, service_role;

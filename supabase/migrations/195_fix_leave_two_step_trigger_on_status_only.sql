-- Fix: enforce_leave_two_step_transition was blocking ANY update on rows
-- already in approved_by_hr status (e.g. clearing account_manager_id on user delete).
-- Only validate when status actually changes.

CREATE OR REPLACE FUNCTION public.enforce_leave_two_step_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved_by_hr' AND OLD.status IS DISTINCT FROM 'approved_by_manager' THEN
      RAISE EXCEPTION 'Leave request must be approved_by_manager before approved_by_hr';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_leave_two_step_transition() IS
  'Validates leave status transitions only when status changes. Allows FK detach updates on historical rows.';

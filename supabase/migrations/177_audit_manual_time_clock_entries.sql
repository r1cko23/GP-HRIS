-- =====================================================
-- 177: Audit trail for manual / HR-managed time clock rows
-- =====================================================
-- Logs INSERT when is_manual_entry is true (HR add, bulk import).
-- Logs UPDATE when the row is or was manual and substantive fields change
-- (not hour recalculations on automatic bundy rows).
-- Logs all DELETEs (admin cleanup).
-- user_id is auth.uid() when available (null for service role / RPC-only context).
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_time_clock_entries_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_manual_entry, false) THEN
      v_new := jsonb_strip_nulls(jsonb_build_object(
        'employee_id', NEW.employee_id,
        'clock_in_time', NEW.clock_in_time,
        'clock_out_time', NEW.clock_out_time,
        'status', NEW.status,
        'is_manual_entry', NEW.is_manual_entry,
        'hr_notes', NEW.hr_notes,
        'employee_notes', NEW.employee_notes,
        'clock_in_device', NEW.clock_in_device,
        'clock_out_device', NEW.clock_out_device
      ));
      INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        created_at
      ) VALUES (
        auth.uid(),
        'INSERT',
        'time_clock_entries',
        NEW.id,
        NULL,
        v_new,
        NOW()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (COALESCE(OLD.is_manual_entry, false) OR COALESCE(NEW.is_manual_entry, false))
       AND (
         OLD.clock_in_time IS DISTINCT FROM NEW.clock_in_time
         OR OLD.clock_out_time IS DISTINCT FROM NEW.clock_out_time
         OR OLD.status IS DISTINCT FROM NEW.status
         OR OLD.hr_notes IS DISTINCT FROM NEW.hr_notes
         OR OLD.employee_notes IS DISTINCT FROM NEW.employee_notes
         OR OLD.is_manual_entry IS DISTINCT FROM NEW.is_manual_entry
         OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
       ) THEN
      v_old := jsonb_strip_nulls(jsonb_build_object(
        'employee_id', OLD.employee_id,
        'clock_in_time', OLD.clock_in_time,
        'clock_out_time', OLD.clock_out_time,
        'status', OLD.status,
        'is_manual_entry', OLD.is_manual_entry,
        'hr_notes', OLD.hr_notes,
        'employee_notes', OLD.employee_notes,
        'clock_in_device', OLD.clock_in_device,
        'clock_out_device', OLD.clock_out_device
      ));
      v_new := jsonb_strip_nulls(jsonb_build_object(
        'employee_id', NEW.employee_id,
        'clock_in_time', NEW.clock_in_time,
        'clock_out_time', NEW.clock_out_time,
        'status', NEW.status,
        'is_manual_entry', NEW.is_manual_entry,
        'hr_notes', NEW.hr_notes,
        'employee_notes', NEW.employee_notes,
        'clock_in_device', NEW.clock_in_device,
        'clock_out_device', NEW.clock_out_device
      ));
      INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        created_at
      ) VALUES (
        auth.uid(),
        'UPDATE',
        'time_clock_entries',
        NEW.id,
        v_old,
        v_new,
        NOW()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := jsonb_strip_nulls(jsonb_build_object(
      'employee_id', OLD.employee_id,
      'clock_in_time', OLD.clock_in_time,
      'clock_out_time', OLD.clock_out_time,
      'status', OLD.status,
      'is_manual_entry', OLD.is_manual_entry,
      'hr_notes', OLD.hr_notes,
      'employee_notes', OLD.employee_notes,
      'clock_in_device', OLD.clock_in_device,
      'clock_out_device', OLD.clock_out_device
    ));
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      auth.uid(),
      'DELETE',
      'time_clock_entries',
      OLD.id,
      v_old,
      NULL,
      NOW()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_time_clock_entries ON public.time_clock_entries;

CREATE TRIGGER trigger_audit_time_clock_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_time_clock_entries_fn();

COMMENT ON FUNCTION public.audit_time_clock_entries_fn() IS
  'Writes audit_logs for manual time_clock_entries and HR edits; skips automatic bundy hour-only updates.';

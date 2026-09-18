/**
 * Human-facing copy for engagement movements shown on the 201 timeline.
 * Stored remarks may still contain machine fields; format before display.
 */

export const STILL_WORKING_REMARKS =
  "Confirmed still at work. We'll check again after the next released payroll.";

export function priorEngagementRemarks(opts: {
  employeeCode?: string | null;
  legacyId?: string | number | null;
}): string {
  const code = opts.employeeCode?.trim() || null;
  const legacyRaw = opts.legacyId;
  const legacy =
    legacyRaw != null && String(legacyRaw).trim() !== ""
      ? String(legacyRaw).trim()
      : null;

  if (code && legacy) {
    return `Linked earlier employee file ${code} (legacy #${legacy}).`;
  }
  if (code) return `Linked earlier employee file ${code}.`;
  if (legacy) return `Linked an earlier employee file (legacy #${legacy}).`;
  return "Linked an earlier employee file.";
}

const MACHINE_FIELD =
  /(?:^|[ ·•])(?:code|legacy_id|source_row|status)=([^ ·•]+)/gi;

function fieldMap(remarks: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of remarks.matchAll(MACHINE_FIELD)) {
    const full = match[0] ?? "";
    const key = full.replace(/^[ ·•]+/, "").split("=")[0]?.toLowerCase();
    const value = match[1];
    if (key && value) out[key] = value;
  }
  return out;
}

function isSystemPriorNote(text: string): boolean {
  return (
    /parked under person master/i.test(text) ||
    /collapsed (to|under) person master/i.test(text) ||
    /extra 201/i.test(text) ||
    /greenhrismain rehire/i.test(text)
  );
}

function isSystemStillWorkingNote(text: string): boolean {
  return (
    /hr confirmed still working/i.test(text) ||
    /keep active;\s*re-check after next/i.test(text)
  );
}

/** Timeline display string; hides UUIDs and key=value dumps. */
export function formatMovementRemarks(
  remarks: string | null | undefined
): string | null {
  if (remarks == null) return null;
  const text = remarks.trim();
  if (!text) return null;

  if (isSystemStillWorkingNote(text)) {
    return STILL_WORKING_REMARKS;
  }

  const fields = fieldMap(text);
  if (isSystemPriorNote(text) || fields.code || fields.legacy_id) {
    return priorEngagementRemarks({
      employeeCode: fields.code ?? null,
      legacyId: fields.legacy_id ?? null,
    });
  }

  return text;
}

/** Stable prefix on loans entered by April Nina Gammad before her login was removed. */
export const APRIL_HR_REVIEW_NOTE =
  "HR audit: entered by April Nina Gammad. Review before the next cutoff.";

export function withAprilHrReviewNote(existing: string | null | undefined): string {
  const body = (existing ?? "").trim();
  if (body.startsWith(APRIL_HR_REVIEW_NOTE)) return body;
  if (!body) return APRIL_HR_REVIEW_NOTE;
  return `${APRIL_HR_REVIEW_NOTE} ${body}`;
}

export function loanNeedsAprilHrReview(notes: string | null | undefined): boolean {
  return (notes ?? "").trim().startsWith(APRIL_HR_REVIEW_NOTE);
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APRIL_HR_REVIEW_NOTE,
  loanNeedsAprilHrReview,
  withAprilHrReviewNote,
} from "../hr-review";

describe("April loan review tag", () => {
  it("marks a blank note for HR review", () => {
    assert.equal(
      withAprilHrReviewNote(null),
      "HR audit: entered by April Nina Gammad. Review before the next cutoff."
    );
    assert.equal(loanNeedsAprilHrReview(withAprilHrReviewNote("")), true);
  });

  it("keeps the existing note after the review tag", () => {
    assert.equal(
      withAprilHrReviewNote("Imported from GREENHRISMAIN loan 3784"),
      `${APRIL_HR_REVIEW_NOTE} Imported from GREENHRISMAIN loan 3784`
    );
  });

  it("does not tag the same loan twice", () => {
    const once = withAprilHrReviewNote("DON");
    assert.equal(withAprilHrReviewNote(once), once);
  });

  it("leaves unrelated notes untagged", () => {
    assert.equal(loanNeedsAprilHrReview("Imported from GREENHRISMAIN loan 1"), false);
    assert.equal(loanNeedsAprilHrReview(null), false);
  });
});

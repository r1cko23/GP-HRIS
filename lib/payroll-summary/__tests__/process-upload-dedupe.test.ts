import { describe, expect, it } from "vitest";
import { newestUploadAndDuplicates } from "../process-register-upload";

describe("newestUploadAndDuplicates", () => {
  it("keeps only the most recently uploaded row for a cutoff", () => {
    const result = newestUploadAndDuplicates([
      { id: "older", uploaded_at: "2026-08-05T01:00:00.000Z" },
      { id: "newest", uploaded_at: "2026-08-05T03:00:00.000Z" },
      { id: "middle", uploaded_at: "2026-08-05T02:00:00.000Z" },
    ]);

    expect(result.newest?.id).toBe("newest");
    expect(result.duplicates.map((row) => row.id)).toEqual([
      "middle",
      "older",
    ]);
  });

  it("uses the id as a deterministic tie-breaker for concurrent uploads", () => {
    const uploadedAt = "2026-08-05T03:00:00.000Z";
    const result = newestUploadAndDuplicates([
      { id: "upload-a", uploaded_at: uploadedAt },
      { id: "upload-b", uploaded_at: uploadedAt },
    ]);

    expect(result.newest?.id).toBe("upload-b");
    expect(result.duplicates.map((row) => row.id)).toEqual(["upload-a"]);
  });

  it("handles an empty result set", () => {
    expect(newestUploadAndDuplicates([])).toEqual({
      newest: null,
      duplicates: [],
    });
  });
});

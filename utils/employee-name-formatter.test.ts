import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatEmployeeNameForDisplay,
  formatEmployeeNameWithId,
} from "./employee-name-formatter";

describe("formatEmployeeNameForDisplay", () => {
  it("shows last, first, and middle in title case instead of ALL CAPS", () => {
    assert.equal(
      formatEmployeeNameForDisplay(
        "ANGELIQUE ANA MAE P. ABARRA",
        "ABARRA",
        "ANGELIQUE ANA MAE",
        "P."
      ),
      "Abarra Angelique Ana Mae P."
    );
  });

  it("title-cases a single full-name string", () => {
    assert.equal(
      formatEmployeeNameForDisplay("juan dela cruz"),
      "Cruz Juan Dela"
    );
  });
});

describe("formatEmployeeNameWithId", () => {
  it("appends the employee id after the title-cased name", () => {
    assert.equal(
      formatEmployeeNameWithId("JUAN CRUZ", "25546", "CRUZ", "JUAN"),
      "Cruz Juan (25546)"
    );
  });
});

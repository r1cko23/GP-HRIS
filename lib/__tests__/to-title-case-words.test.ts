import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toTitleCaseWords } from "../utils";

describe("toTitleCaseWords", () => {
  it("title-cases ALL CAPS first and last names", () => {
    assert.equal(toTitleCaseWords("JUAN DELA CRUZ"), "Juan Dela Cruz");
    assert.equal(
      toTitleCaseWords("MANALO, JESSE EDWARD"),
      "Manalo, Jesse Edward"
    );
  });

  it("title-cases lowercase names and place nouns", () => {
    assert.equal(toTitleCaseWords("juan dela cruz"), "Juan Dela Cruz");
    assert.equal(toTitleCaseWords("quezon city"), "Quezon City");
  });

  it("keeps Jr/Sr mixed case and roman-numeral suffixes uppercase", () => {
    assert.equal(toTitleCaseWords("santos jr"), "Santos Jr");
    assert.equal(toTitleCaseWords("AYAG JR."), "Ayag Jr.");
    assert.equal(toTitleCaseWords("JOAQUIN III"), "Joaquin III");
    assert.equal(toTitleCaseWords("delos reyes iv"), "Delos Reyes IV");
  });

  it("title-cases hyphenated and apostrophe names", () => {
    assert.equal(toTitleCaseWords("SANTA-ANA"), "Santa-Ana");
    assert.equal(toTitleCaseWords("D'ANGELO"), "D'Angelo");
  });

  it("keeps short HR/payroll acronyms uppercase", () => {
    assert.equal(toTitleCaseWords("IT DEPARTMENT"), "IT Department");
    assert.equal(toTitleCaseWords("sss"), "SSS");
  });
});

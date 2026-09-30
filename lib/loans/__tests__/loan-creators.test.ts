import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APRIL_LOAN_CREATOR_ID,
  filterLoansByCreator,
  loanCreatorChoices,
} from "../loan-creators";

const JERICKO = "97b8235a-d831-42f5-ae2c-e559ab8e0df1";

describe("loanCreatorChoices", () => {
  it("lists each person who created a loan, including a removed login", () => {
    const { creators, creatorByLoanId } = loanCreatorChoices(
      [
        { loanId: "april-a", createdBy: APRIL_LOAN_CREATOR_ID },
        { loanId: "april-b", createdBy: APRIL_LOAN_CREATOR_ID },
        { loanId: "jericko", createdBy: JERICKO },
        { loanId: "import", createdBy: null },
      ],
      [{ id: JERICKO, name: "Jericko Razal" }]
    );

    assert.deepEqual(creators, [
      { id: APRIL_LOAN_CREATOR_ID, name: "April Nina Gammad" },
      { id: JERICKO, name: "Jericko Razal" },
    ]);
    assert.equal(creatorByLoanId.get("april-a"), APRIL_LOAN_CREATOR_ID);
    assert.equal(creatorByLoanId.has("import"), false);
  });

  it("returns no creators when every loan was imported without a person", () => {
    const { creators } = loanCreatorChoices(
      [{ loanId: "import", createdBy: null }],
      []
    );
    assert.deepEqual(creators, []);
  });

  it("keeps only the chosen creator's loans", () => {
    const { creatorByLoanId } = loanCreatorChoices(
      [
        { loanId: "april-a", createdBy: APRIL_LOAN_CREATOR_ID },
        { loanId: "jericko", createdBy: JERICKO },
        { loanId: "import", createdBy: null },
      ],
      [{ id: JERICKO, name: "Jericko Razal" }]
    );
    const loans = [{ id: "april-a" }, { id: "jericko" }, { id: "import" }];
    assert.deepEqual(
      filterLoansByCreator(loans, creatorByLoanId, APRIL_LOAN_CREATOR_ID).map(
        (row) => row.id
      ),
      ["april-a"]
    );
    assert.equal(
      filterLoansByCreator(loans, creatorByLoanId, null).length,
      3
    );
    assert.deepEqual(
      filterLoansByCreator(loans, creatorByLoanId, "00000000-0000-4000-8000-000000000000"),
      []
    );
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BDO_DEFAULT_COMPANY_CODE,
  BDO_DEFAULT_FUNDING_ACCOUNT,
  buildBdoAtmCreditTxt,
  bdoAtmCreditFilename,
  formatAtField,
  formatBdoAmount,
  formatFundingAccount,
  prepareBdoAtmCreditRows,
} from "../bdo-atm-credit-file";

describe("BDO ATM credit .txt (converter sample format)", () => {
  it("pads @ fields left-aligned to width 10 like Format(x,\"@@@@@@@@@@\")", () => {
    assert.equal(formatAtField("1", 10), "1         ");
    assert.equal(formatAtField("D7I", 10), "D7I       ");
  });

  it("formats funding account like Format(x,\"##00000000\")", () => {
    assert.equal(formatFundingAccount("2110254455"), "2110254455");
    assert.equal(formatFundingAccount("123"), "00000123");
  });

  it("formats amounts with two decimals", () => {
    assert.equal(formatBdoAmount(6779.24), "6779.24");
    assert.equal(formatBdoAmount(100), "100.00");
    assert.equal(formatBdoAmount(7465), "7465.00");
  });

  it("builds tab-separated CRLF detail lines like the converter sample", () => {
    const result = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 1,
      companyCode: BDO_DEFAULT_COMPANY_CODE,
      fundingAccount: BDO_DEFAULT_FUNDING_ACCOUNT,
      rows: [
        { accountNo: "002114616785", amount: 7465 },
        { accountNo: "002114671670", amount: 9221.18 },
      ],
      today: "2026-09-26",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filename, "D7I09262601.txt");
    assert.equal(result.recordCount, 2);
    assert.equal(result.totalAmount, 16686.18);
    assert.equal(
      result.text,
      "002114616785\t7465.00\r\n002114671670\t9221.18\r\n"
    );
    assert.equal(result.text.includes("H"), false);
    assert.equal(result.text.startsWith("T"), false);
  });

  it("matches the golden converter sample body (D7I09262601.txt)", () => {
    const samplePath = join(process.cwd(), "D7I09262601.txt");
    const sampleRaw = readFileSync(samplePath);
    // Normalize rare trailing CR quirk; compare record lines.
    const sampleLines = sampleRaw
      .toString("binary")
      .split(/\r\n|\n|\r/)
      .map((l) => l.replace(/\r/g, "").trim())
      .filter(Boolean);

    const rows = sampleLines.map((line) => {
      const [accountNo, amount] = line.split("\t");
      return { accountNo: accountNo!, amount: Number(amount) };
    });

    const result = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 1,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows,
      today: "2026-09-26",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.filename, "D7I09262601.txt");
    assert.equal(result.recordCount, sampleLines.length);

    const builtLines = result.text
      .split("\r\n")
      .map((l) => l.trim())
      .filter(Boolean);
    assert.deepEqual(builtLines, sampleLines);
  });

  it("rejects past upload dates, bad batch, negative amounts, empty accounts", () => {
    const past = buildBdoAtmCreditTxt({
      uploadDate: "2020-01-01",
      batchNo: 1,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows: [{ accountNo: "002114822164", amount: 100 }],
      today: "2026-09-26",
    });
    assert.equal(past.ok, false);

    const badBatch = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 100,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows: [{ accountNo: "002114822164", amount: 100 }],
      today: "2026-09-26",
    });
    assert.equal(badBatch.ok, false);

    const neg = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 1,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows: [{ accountNo: "002114822164", amount: -1 }],
      today: "2026-09-26",
    });
    assert.equal(neg.ok, false);

    const emptyAcct = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 1,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows: [{ accountNo: "", amount: 100 }],
      today: "2026-09-26",
    });
    assert.equal(emptyAcct.ok, false);
  });

  it("skips zero-net rows as warnings and fails when no payable rows remain", () => {
    const prepared = prepareBdoAtmCreditRows([
      { accountNo: "002114822164", amount: 0, name: "ZERO" },
      { accountNo: "123456789012", amount: 50, name: "OK" },
    ]);
    assert.equal(prepared.rows.length, 1);
    assert.equal(prepared.warnings.length, 1);

    const onlyZero = buildBdoAtmCreditTxt({
      uploadDate: "2026-09-26",
      batchNo: 1,
      companyCode: "D7I",
      fundingAccount: "2110254455",
      rows: [{ accountNo: "002114822164", amount: 0 }],
      today: "2026-09-26",
    });
    assert.equal(onlyZero.ok, false);
  });

  it("builds BDO converter filename {company}{MMDDYY}{batch}", () => {
    assert.equal(
      bdoAtmCreditFilename({
        uploadDate: "2026-09-26",
        batchNo: 1,
        companyCode: "D7I",
      }),
      "D7I09262601.txt"
    );
  });
});

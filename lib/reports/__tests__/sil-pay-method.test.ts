import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSilMonthlyRow } from "../sil-monthly-run";
import {
  resolveSilPayMethod,
  silPayMethodLabel,
} from "../sil-pay-method";

describe("resolveSilPayMethod", () => {
  it("pays listed hotels as casual/on-call pro-rated", () => {
    assert.equal(
      resolveSilPayMethod("Sm Prime Holdings Inc.-Conrad Hotel"),
      "casual_prorated"
    );
    assert.equal(
      resolveSilPayMethod("DELUXE HOTELS AND RECREATION INC"),
      "casual_prorated"
    );
    assert.equal(
      resolveSilPayMethod("Tiger Resort Leisure & Entertainment Inc"),
      "casual_prorated"
    );
    assert.equal(
      resolveSilPayMethod("Pico De Loro Beach And Country Club Inc."),
      "casual_prorated"
    );
    assert.equal(
      resolveSilPayMethod("Sm Prime Holdings Inc.-Pico De Loro"),
      "casual_prorated"
    );
    assert.equal(resolveSilPayMethod("Admiral Hotel"), "casual_prorated");
  });

  it("pays non-hotels, Aldex, and SM Development as full 313 upon anniversary", () => {
    assert.equal(
      resolveSilPayMethod("Aldex Realty Corporation"),
      "full_313_anniversary"
    );
    assert.equal(
      resolveSilPayMethod("SM DEVELOPMENT CORP"),
      "full_313_anniversary"
    );
    assert.equal(
      resolveSilPayMethod("Goldilocks Bakeshop Inc."),
      "full_313_anniversary"
    );
    assert.equal(
      resolveSilPayMethod("Berjaya (Paris Baguette)"),
      "full_313_anniversary"
    );
    assert.equal(resolveSilPayMethod("Plk Phils. Inc"), "full_313_anniversary");
    assert.equal(
      resolveSilPayMethod("Popeyes Louisiana Kitchen Philippines Inc"),
      "full_313_anniversary"
    );
    assert.equal(
      resolveSilPayMethod("Vouno Trade & Marketing Services, Corp."),
      "full_313_anniversary"
    );
    assert.equal(
      resolveSilPayMethod("Teppanya Restuarant Alabang Inc"),
      "full_313_anniversary"
    );
  });

  it("does not classify a client that is not on the pay sheet", () => {
    assert.equal(resolveSilPayMethod("Nabati Food Philippines Inc."), null);
    assert.equal(
      resolveSilPayMethod("Hotel Specialist (Manila) Inc- Lanson Place"),
      null
    );
    assert.equal(resolveSilPayMethod(""), null);
    assert.equal(resolveSilPayMethod(null), null);
  });

  it("prefers an explicit stored method over the name catalog", () => {
    assert.equal(
      resolveSilPayMethod("Goldilocks Bakeshop Inc.", "casual_prorated"),
      "casual_prorated"
    );
    assert.equal(
      resolveSilPayMethod("Unknown Cafe", "full_313_anniversary"),
      "full_313_anniversary"
    );
    assert.equal(resolveSilPayMethod("Unknown Cafe", "nope"), null);
  });
});

describe("full 313 anniversary amount", () => {
  it("pays days/313 × 5 × rate, matching a full statutory year at 5 days", () => {
    const row = buildSilMonthlyRow({
      last_name: "Cruz",
      first_name: "Ana",
      hire_date: "2024-08-01",
      status: "active",
      daily_rate: 600,
      days_worked: 313,
      pay_method: "full_313_anniversary",
    });
    assert.equal(row.days_entitlement, 5);
    assert.equal(row.amount, 3000);
    assert.equal(row.months, 1);
  });

  it("matches MAIN silp on the same days (13 × 600 → 124.60)", () => {
    const row = buildSilMonthlyRow({
      last_name: "Aban",
      first_name: "Claire",
      hire_date: "2020-01-15",
      status: "active",
      daily_rate: 600,
      days_worked: 13,
      pay_method: "full_313_anniversary",
    });
    assert.equal(row.amount, 124.6);
  });

  it("keeps the hotel pro-rate when the client is casual/on-call", () => {
    const casual = buildSilMonthlyRow({
      last_name: "Lamar",
      first_name: "Ana",
      hire_date: "2024-03-14",
      status: "active",
      daily_rate: 695,
      days_worked: 302.06,
      pay_method: "casual_prorated",
    });
    const full = buildSilMonthlyRow({
      last_name: "Lamar",
      first_name: "Ana",
      hire_date: "2024-03-14",
      status: "active",
      daily_rate: 695,
      days_worked: 302.06,
      pay_method: "full_313_anniversary",
    });
    assert.equal(casual.days_entitlement, 4.84);
    assert.equal(casual.amount, 3363.8);
    assert.equal(full.amount, 3353.54);
    assert.notEqual(full.amount, casual.amount);
  });

  it("returns 0 when days or rate are missing", () => {
    const row = buildSilMonthlyRow({
      last_name: "Cruz",
      first_name: "Ben",
      hire_date: "2023-03-01",
      status: "inactive",
      daily_rate: 500,
      days_worked: 0,
      pay_method: "full_313_anniversary",
    });
    assert.equal(row.amount, 0);
    assert.equal(row.days_entitlement, 0);
    assert.match(row.remarks, /missing/i);
  });
});

describe("silPayMethodLabel", () => {
  it("uses the payroll sheet wording", () => {
    assert.equal(
      silPayMethodLabel("casual_prorated"),
      "Casual/On-call — pro-rated"
    );
    assert.equal(
      silPayMethodLabel("full_313_anniversary"),
      "Full 313 — upon anniversary"
    );
  });
});

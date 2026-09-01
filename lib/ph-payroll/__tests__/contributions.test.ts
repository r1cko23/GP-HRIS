import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePhilHealth,
  calculatePagIBIG,
  calculateSSS,
  calculateSssEcc,
} from "../contributions";
import { getCutoffStatutoryDeductions } from "../statutory-cutoff";

describe("calculatePagIBIG", () => {
  it("uses 1% EE / 2% ER at or below ₱1,500 fund salary", () => {
    const pag = calculatePagIBIG(1500);
    assert.equal(pag.fundSalary, 1500);
    assert.equal(pag.employeeShare, 15);
    assert.equal(pag.employerShare, 30);
    assert.equal(pag.total, 45);
  });

  it("uses 2% EE / 2% ER above ₱1,500", () => {
    const pag = calculatePagIBIG(5000);
    assert.equal(pag.employeeShare, 100);
    assert.equal(pag.employerShare, 100);
    assert.equal(pag.total, 200);
  });

  it("caps fund salary at ₱10,000 MFS", () => {
    const pag = calculatePagIBIG(25000);
    assert.equal(pag.fundSalary, 10000);
    assert.equal(pag.employeeShare, 200);
    assert.equal(pag.employerShare, 200);
    assert.equal(pag.total, 400);
  });
});

describe("calculatePhilHealth", () => {
  it("applies the ₱10,000 salary floor", () => {
    const ph = calculatePhilHealth(8000);
    assert.equal(ph.premiumBase, 10000);
    assert.equal(ph.total, 500);
    assert.equal(ph.employeeShare, 250);
    assert.equal(ph.employerShare, 250);
  });

  it("computes 5% between floor and ceiling", () => {
    const ph = calculatePhilHealth(25000);
    assert.equal(ph.premiumBase, 25000);
    assert.equal(ph.employeeShare, 625);
  });

  it("applies the ₱100,000 salary ceiling", () => {
    const ph = calculatePhilHealth(150000);
    assert.equal(ph.premiumBase, 100000);
    assert.equal(ph.total, 5000);
    assert.equal(ph.employeeShare, 2500);
  });
});

describe("calculateSssEcc", () => {
  it("uses ₱10 ECC at or below MSC ₱14,500", () => {
    assert.equal(calculateSssEcc(5000), 10);
    assert.equal(calculateSssEcc(14500), 10);
  });

  it("uses ₱30 ECC at MSC ₱15,000 and above", () => {
    assert.equal(calculateSssEcc(15000), 30);
    assert.equal(calculateSssEcc(35000), 30);
  });
});

describe("getCutoffStatutoryDeductions ECC", () => {
  it("includes half-monthly ECC on the cutoff statutory return", () => {
    const d = getCutoffStatutoryDeductions(20000);
    const sss = calculateSSS(20000);
    assert.equal(sss.ecc, 30);
    assert.equal(d.sss_ecc, 15);
  });
});

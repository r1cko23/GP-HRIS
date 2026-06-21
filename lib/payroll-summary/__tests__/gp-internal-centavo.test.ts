import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parsePayrollRegisterPdfResult } from "../parse-payroll-register-pdf";
import {
  computeRollupGapCentavos,
  validateParsedRegisterMetrics,
} from "../validate-parsed-register";

const GP_SAMPLES = ["05-16-26.pdf", "06-01-26.pdf"];

describe("GP internal payroll register — centavo tie-out", () => {
  for (const fileName of GP_SAMPLES) {
    const filePath = join(process.cwd(), fileName);
    if (!existsSync(filePath)) continue;

    it(`rolls up gross to the centavo for ${fileName}`, async () => {
      const result = await parsePayrollRegisterPdfResult(readFileSync(filePath));
      const { metrics, pdfText } = result;

      expect(computeRollupGapCentavos(metrics)).toBe(0);
      expect(() =>
        validateParsedRegisterMetrics(metrics, {
          pdfText,
          requireExactCentavos: true,
        })
      ).not.toThrow();
    });
  }
});

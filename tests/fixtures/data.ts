import { env } from "./env";

export const testData = {
  loanAmount: env("TEST_LOAN_AMOUNT") || "10000",
  loanTerms: env("TEST_LOAN_TERMS") || "6",
  payslipEmployeeId: env("TEST_PAYSLIP_EMPLOYEE_ID"),
  approverEmployeeId: env("TEST_APPROVER_EMPLOYEE_ID"),
};

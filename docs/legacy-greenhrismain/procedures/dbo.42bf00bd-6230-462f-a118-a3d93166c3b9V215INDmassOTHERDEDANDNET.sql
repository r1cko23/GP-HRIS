CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassOTHERDEDANDNET]
@idclient VARCHAR(20),
@PayrollPeriodStart DATE
AS
BEGIN
SET NOCOUNT ON;

------------------------------------------------------------
-- 1. MAP OTHER DEDUCTIONS → PAYROLL SUMMARY
------------------------------------------------------------
UPDATE od
SET od.idpayrollsum = ps.idpayrollsum
FROM otherdeduction od
INNER JOIN payroll_summary ps
    ON ps.employee_id = od.employee_id
    AND ps.idclientp = @idclient
    AND ps.Date_Start = @PayrollPeriodStart
WHERE od.idclientdeduction = @idclient
AND od.Date_Start = @PayrollPeriodStart;

------------------------------------------------------------
-- 2. SUM OTHER DEDUCTIONS
------------------------------------------------------------
;WITH DeductionSum AS (
    SELECT 
        idpayrollsum,
        SUM(ISNULL(amount,0)) AS totalamount,
        SUM(ISNULL(amount2,0)) AS totalamount2
    FROM otherdeduction
    GROUP BY idpayrollsum
)
UPDATE ps
SET 
    ps.Other_Deduction = ds.totalamount,
    ps.Other_Deduction2 = ds.totalamount2
FROM payroll_summary ps
LEFT JOIN DeductionSum ds
    ON ps.idpayrollsum = ds.idpayrollsum
WHERE ps.idclientp = @idclient
AND ps.Date_Start = @PayrollPeriodStart;

------------------------------------------------------------
-- 3. COMPUTE TOTAL DEDUCTION
------------------------------------------------------------
UPDATE ps
SET Totaldeduction =
    ISNULL(ps.contributionSSSEE,0) +
    ISNULL(ps.contributionSSSEEpro,0) +
    ISNULL(ps.contributionphilhealthEE,0) +
    ISNULL(ps.contributionpagibigEE,0) +
    ISNULL(ps.wtax,0) +
    ISNULL(ps.Other_Deduction,0)
FROM payroll_summary ps
WHERE ps.idclientp = @idclient
AND ps.Date_Start = @PayrollPeriodStart;

------------------------------------------------------------
-- 4. COMPUTE NET
------------------------------------------------------------
UPDATE ps
SET 
    netamount = 
        CAST(ISNULL(ps.grossalary,0) AS DECIMAL(18,2)) 
        - CAST(ISNULL(ps.Totaldeduction,0) AS DECIMAL(18,2)),
        
    netamount2 = 
        CAST(ISNULL(ps.grossalary,0) AS FLOAT) 
        - CAST(ISNULL(ps.Totaldeduction,0) AS FLOAT)
        + ISNULL(ps.Other_Deduction2,0)
FROM payroll_summary ps
WHERE ps.idclientp = @idclient
AND ps.Date_Start = @PayrollPeriodStart;

------------------------------------------------------------
-- 5. NET < 2000 CONDITION (PRESERVED)
------------------------------------------------------------
;WITH MaxPayroll AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY grossalary DESC) rn
    FROM payroll_summary
    WHERE idclientp = @idclient
    AND Date_Start = @PayrollPeriodStart
    AND netamount <= 2000
)
UPDATE ps
SET 
    contributionSSSEE = 0,
    contributionSSSER = 0,
    contributionSSSEEPRO = 0,
    contributionSSSERPRO = 0,
    contributionSSSECC = 0,
    contributionphilhealthEE = 0,
    contributionphilhealthER = 0,
    contributionPagibigEE = 0,
    contributionPagibigER = 0,
    withsss = 'N',
    withphi = 'N',
    withpag = 'N',
    withssspro = 'N'
FROM payroll_summary ps
INNER JOIN MaxPayroll mp
    ON ps.idpayrollsum = mp.idpayrollsum
WHERE mp.rn = 1;

------------------------------------------------------------
-- 6. RECOMPUTE AFTER RESET (<2000)
------------------------------------------------------------
UPDATE ps
SET Totaldeduction =
    ISNULL(ps.contributionSSSEE,0) +
    ISNULL(ps.contributionSSSEEPRO,0) +
    ISNULL(ps.contributionphilhealthEE,0) +
    ISNULL(ps.contributionpagibigEE,0) +
    ISNULL(ps.wtax,0) +
    ISNULL(ps.Other_Deduction,0)
FROM payroll_summary ps
WHERE ps.idclientp = @idclient
AND ps.Date_Start = @PayrollPeriodStart;

UPDATE ps
SET 
    netamount = ISNULL(ps.grossalary,0) - ISNULL(ps.Totaldeduction,0),
    netamount2 = ISNULL(ps.grossalary,0) - ISNULL(ps.Totaldeduction,0)
FROM payroll_summary ps
WHERE ps.idclientp = @idclient
AND ps.Date_Start = @PayrollPeriodStart;

END